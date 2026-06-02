import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

// 生成JWT token
export const generateToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

// 验证JWT token
export const verifyToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};