// 统一响应格式工具

export const success = (res, data = null, message = '操作成功') => {
  res.json({
    code: 200,
    message,
    data
  });
};

export const error = (res, message = '操作失败', statusCode = 400, extraData = null) => {
  res.status(statusCode).json({
    code: statusCode,
    message,
    data: extraData
  });
};
