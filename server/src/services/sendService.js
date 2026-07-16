/**
 * 共享发送服务 - 统一的生日贺卡发送流程（阶段八：视频版）
 *
 * 流程：匹配模板 → 生成贺卡文件夹 → 录制视频 → 创建记录 → 发送短信/彩信 → 更新状态
 */
import { Op } from 'sequelize';
import fs from 'fs/promises';
import path from 'path';
import { sequelize, Employee, Template, Blessing, SendRecord } from '../models/index.js';
import { matchTemplate } from './templateMatcher.js';
import { generateCard } from './cardGenerator.js';
import { sendSMS } from './smsService.js';
import { config } from '../config/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('send');

/**
 * 构建短信/彩信内容文本
 *
 * CSP 5G 视频短信使用模板 ID 发送，实际内容由中国移动模板决定。
 * sms_content 字段用于记录展示，格式为"姓名+先生/女士"，方便管理员确认发送对象。
 */
const buildSmsBody = (employeeName, employeeGender, videoTemplateId) => {
  const genderTitle = employeeGender === 'male' ? '先生' : '女士';
  const recipient = `${employeeName}${genderTitle}`;
  return videoTemplateId
    ? `【视频短信】收件人：${recipient}，模板ID：${videoTemplateId}`
    : `【贺卡通知】收件人：${recipient}`;
};

/**
 * 异步延迟工具函数
 */
const delay = ms => new Promise(r => setTimeout(r, ms));

/**
 * 带指数退避的短信发送包装器
 */
const sendSMSWithRetry = async (phone, smsBody, employeeName) => {
  const maxRetries = config.sms?.maxRetries || 3;
  let smsResult;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    smsResult = await sendSMS(phone, smsBody, employeeName);

    if (smsResult.success) {
      smsResult.retryCount = attempt;
      return smsResult;
    }

    if (attempt < maxRetries) {
      const waitTime = Math.pow(2, attempt) * 1000;
      logger.warn(`[发送服务重试] 第 ${attempt + 1}/${maxRetries} 次重试，等待 ${waitTime}ms，原因: ${smsResult.error}`);
      await delay(waitTime);
    }
  }

  smsResult.retryCount = maxRetries;
  logger.error(`[发送服务] 短信发送已重试 ${maxRetries} 次仍然失败: ${smsResult.error}`);
  return smsResult;
};

/**
 * 为指定员工发送生日贺卡（含视频录制）
 *
 * @param {object} options
 * @param {number} options.employeeId - 员工ID
 * @param {number|null} [options.adminId] - 操作管理员ID
 * @param {boolean} [options.skipIfSentToday] - 是否跳过今天已成功发送的员工
 * @param {object[]} [options.preloadedTemplates] - 预加载的模板列表
 * @returns {Promise<object>} 发送结果
 */
export const sendBirthdayCard = async ({ employeeId, adminId = null, skipIfSentToday = false, preloadedTemplates = null }) => {
  const fail = (errorMsg, extra = {}) => ({
    success: false, error: errorMsg,
    employee: null, template: null, cardUrl: null, cardId: null,
    videoUrl: null, videoPath: null,
    smsStatus: null, smsProvider: null, messageId: null, smsContent: null,
    employeeName: null, templateName: null,
    ...extra
  });

  // 1. 检查员工
  logger.info(`[发送服务] 步骤 1/5 - 查找员工 (ID: ${employeeId})...`);
  const employee = await Employee.findByPk(employeeId, {
    include: [{ model: Template, as: 'default_template', include: [{ model: Blessing, as: 'default_blessing' }] }]
  });
  if (!employee) return fail('员工不存在');

  const employeeName = employee.name;
  logger.info(`[发送服务] 找到员工: ${employeeName}`);

  // 防重复
  if (skipIfSentToday) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const alreadySent = await SendRecord.findOne({
      where: {
        employee_id: employeeId,
        send_status: 'success',
        send_time: { [Op.gte]: todayStart, [Op.lt]: todayEnd }
      }
    });
    if (alreadySent) {
      return {
        success: true, error: '今日已发送，跳过',
        employee, template: null, cardUrl: null, cardId: null,
        videoUrl: null, videoPath: null,
        smsStatus: 'success', smsProvider: null, messageId: null, smsContent: null,
        employeeName, templateName: null
      };
    }
  }

  // 2. 匹配模板
  logger.info(`[发送服务] 步骤 2/5 - 匹配模板...`);
  const template = await matchTemplate(employee, preloadedTemplates);
  if (!template) return fail('没有可用的模板', { employee, employeeName });

  const templateName = template.name;
  logger.info(`[发送服务] 匹配到模板: ${templateName}`);
  let cardResult = null;

  try {
    // 3. 生成贺卡 + 录制视频
    logger.info(`[发送服务] 步骤 3/5 - 生成贺卡并录制视频（此步骤耗时较长，约 2-3 分钟）...`);
    cardResult = await generateCard(template, employee);
    const videoAttempted = cardResult.videoAttempted === true;
    const videoOk = !!cardResult.videoPath;
    logger.info(`[发送服务] 贺卡生成完成：视频${videoOk ? '已生成' : videoAttempted ? '录制失败' : '未录制（旧模板）'}`);

    // 4. 创建发送记录
    const { loadCspConfig } = await import('../config/carrier-sms.config.js');
    const videoTemplateId = loadCspConfig().videoTemplateId || '';
    const smsBody = buildSmsBody(employeeName, employee.gender, videoTemplateId);
    const record = await sequelize.transaction(async (t) => {
      const initialStatus = videoAttempted && !videoOk ? 'failed' : (videoOk ? 'recorded' : 'pending');
      const newRecord = await SendRecord.create({
        employee_id: employee.id,
        template_id: template.id,
        card_url: cardResult.cardUrl,
        card_id: cardResult.cardId,
        card_dir: cardResult.cardDir,
        video_path: cardResult.videoPath,
        video_url: cardResult.videoUrl,
        send_status: initialStatus,
        send_time: new Date(),
        admin_id: adminId,
        sms_content: smsBody
      }, { transaction: t });

      // 5. 发送短信/彩信（视频失败时仍发送贺卡链接作为兜底）
      logger.info(`[发送服务] 步骤 5/5 - 发送短信到 ${employee.phone}...`);
      const smsResult = await sendSMSWithRetry(employee.phone, smsBody, employeeName);
      logger.info(`[发送服务] 短信发送结果: ${smsResult.success ? '成功' : '失败 - ' + smsResult.error}`);

      // 6. 更新状态：视频录制失败时整体为 failed，否则取决于短信结果
      let finalStatus;
      let errorMsg = null;
      if (videoAttempted && !videoOk) {
        finalStatus = 'failed';
        errorMsg = '视频录制失败';
        if (!smsResult.success) {
          errorMsg += `，短信发送也失败: ${smsResult.error}`;
        } else {
          errorMsg += '（已发送贺卡链接兜底）';
        }
      } else {
        finalStatus = smsResult.success ? 'success' : 'failed';
        errorMsg = smsResult.error || null;
      }

      await newRecord.update({
        send_status: finalStatus,
        message_id: smsResult.messageId,
        sms_provider: smsResult.provider,
        retry_count: smsResult.retryCount,
        error_message: errorMsg,
        send_time: new Date()
      }, { transaction: t });

      return { record: newRecord, smsResult, finalStatus };
    });

    const overallSuccess = record.finalStatus === 'success';
    return {
      success: overallSuccess,
      employee,
      template,
      cardUrl: cardResult.cardUrl,
      cardId: cardResult.cardId,
      videoUrl: cardResult.videoUrl,
      videoPath: cardResult.videoPath,
      smsStatus: record.finalStatus,
      smsProvider: record.smsResult.provider,
      messageId: record.smsResult.messageId,
      smsContent: smsBody,
      employeeName,
      templateName,
      error: record.record.error_message || null
    };
  } catch (err) {
    // 创建失败记录（保留审计痕迹，即使贺卡生成崩溃也能在发送记录中查到）
    try {
      await SendRecord.create({
        employee_id: employee.id,
        template_id: template.id,
        send_status: 'failed',
        send_time: new Date(),
        admin_id: adminId,
        error_message: `贺卡生成异常: ${err.message}`,
        card_url: cardResult?.cardUrl || null,
        card_id: cardResult?.cardId || null,
        card_dir: cardResult?.cardDir || null,
        video_path: null,
        video_url: null
      });
    } catch (dbErr) {
      logger.error(`[发送服务] 创建失败记录异常: ${dbErr.message}`);
    }

    // 清理已生成的文件
    if (cardResult?.cardId) {
      const cardDir = path.resolve(config.cardsDir, cardResult.cardId);
      await fs.rm(cardDir, { recursive: true, force: true }).catch(() => {});
      const videoPath = path.resolve(config.videosDir, `${cardResult.cardId}.mp4`);
      await fs.unlink(videoPath).catch(() => {});
    }
    throw err;
  }
};
