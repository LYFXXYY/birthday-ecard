// 短信发送服务（预留接口）
/**
 * 发送短信/彩信
 * @param {string} phone - 接收方手机号
 * @param {string} message - 短信内容
 * @returns {Promise<{success: boolean, messageId: string}>}
 */
export const sendSMS = async (phone, message) => {
  // TODO: 对接移动公司提供的具体接口
  // 预计实现：
  // const response = await axios.post(MOBILE_API_URL, {
  //   phone: phone,
  //   content: content,
  //   type: 'mms'  // 或 'sms'
  // });
  // return response.data;
  
  // 开发阶段模拟发送
  console.log(`[短信发送模拟] 手机: ${phone}, 内容: ${message}`);
  return {
    success: true,
    messageId: `msg_${Date.now()}`
  };
};