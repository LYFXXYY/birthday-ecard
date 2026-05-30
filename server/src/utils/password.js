import bcrypt from 'bcryptjs';

// 密码加密，返回哈希值
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// 验证密码，返回布尔值
export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};