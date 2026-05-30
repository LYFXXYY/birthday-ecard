import xlsx from 'xlsx';

/**
 * 性别转换：将中文或各种格式转换为 male/female
 */
const convertGender = (value) => {
  if (!value) return null;
  const v = String(value).toLowerCase().trim();
  if (v === '男' || v === 'male' || v === 'm') return 'male';
  if (v === '女' || v === 'female' || v === 'f') return 'female';
  return value;
};

/**
 * 解析日期为 YYYY-MM-DD 格式
 */
const parseDate = (value) => {
  if (!value) return null;
  
  // Excel日期数字格式
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  // 字符串日期
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
};

/**
 * 解析Excel文件，返回员工数据数组
 */
export const parseEmployeeExcel = (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  return data.map(row => ({
    name: row['姓名'] || row['name'],
    gender: convertGender(row['性别'] || row['gender']),
    birthday: parseDate(row['生日'] || row['birthday']),
    phone: String(row['手机号'] || row['phone'] || '').trim(),
    department: row['部门'] || row['department'] || '',
    position: row['职位'] || row['position'] || ''
  }));
};

/**
 * 验证员工数据格式
 */
export const validateEmployee = (emp) => {
  const errors = [];
  
  if (!emp.name) errors.push('姓名不能为空');
  if (!emp.gender) errors.push('性别不能为空');
  if (!emp.birthday) errors.push('生日不能为空');
  if (!emp.phone || emp.phone.length < 11) errors.push('手机号格式不正确');
  
  return errors;
};