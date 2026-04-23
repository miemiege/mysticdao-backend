/**
 * 真太阳时换算模块
 *
 * 真太阳时 = 平太阳时(北京时间) + 经度时差 + 均时差
 *
 * 经度时差 = (当地经度 - 120°) × 4分钟/度
 *   东经120°为北京时间基准（中国标准时）
 *
 * 均时差（Equation of Time）= 真太阳时 - 平太阳时
 *   来源：Meeus《天文算法》第二十五章
 *   简化公式（精度约±1分钟，足够八字排盘）：
 *   E = 9.87·sin(2B) - 7.53·cos(B) - 1.5·sin(B)  秒
 *   其中 B = 360° × (N - 81) / 365
 *   N = 年内第几天（1月1日=1）
 */

/** 年内第N天（1-365/366） */
function dayOfYear(year: number, month: number, day: number): number {
  const d = new Date(year, month - 1, day);
  const start = new Date(year, 0, 1);
  return Math.floor((d.getTime() - start.getTime()) / 86400000) + 1;
}

/** 均时差（秒），范围约 -14分钟 ~ +16分钟 */
function equationOfTime(year: number, month: number, day: number): number {
  const N = dayOfYear(year, month, day);
  const B = (360 * (N - 81)) / 365 * (Math.PI / 180); // 转弧度
  const E = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  return E; // 单位：秒
}

/** 经度时差（分钟） */
function longitudeDelta(longitude: number): number {
  // 北京时间以 120°E 为基准
  return (longitude - 120) * 4; // 每度4分钟
}

export interface SolarTimeResult {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * 将北京时间换算为真太阳时
 * @param year 公历年份
 * @param month 公历月份（1-12）
 * @param day 公历日期
 * @param hour 小时（0-23）
 * @param minute 分钟（0-59）
 * @param longitude 当地经度（度，东经为正）
 * @returns 真太阳时的年月日时分
 */
export function toSolarTime(
  year: number, month: number, day: number,
  hour: number, minute: number, longitude: number
): SolarTimeResult {
  // 总偏移量（分钟）
  const lonDeltaMin = longitudeDelta(longitude); // 经度时差（分钟）
  const eqTimeSec = equationOfTime(year, month, day); // 均时差（秒）
  const eqTimeMin = eqTimeSec / 60; // 均时差（分钟）

  const totalDeltaMin = lonDeltaMin + eqTimeMin;

  // 原始时间转为分钟数（从当日0:00起算）
  let totalMinutes = hour * 60 + minute + totalDeltaMin;

  // 处理日期跨越
  let resultDay = day;
  let resultMonth = month;
  let resultYear = year;

  while (totalMinutes < 0) {
    totalMinutes += 1440; // 加一天
    const prev = new Date(year, month - 1, day - 1);
    resultYear = prev.getFullYear();
    resultMonth = prev.getMonth() + 1;
    resultDay = prev.getDate();
  }

  while (totalMinutes >= 1440) {
    totalMinutes -= 1440; // 减一天
    const next = new Date(year, month - 1, day + 1);
    resultYear = next.getFullYear();
    resultMonth = next.getMonth() + 1;
    resultDay = next.getDate();
  }

  const resultHour = Math.floor(totalMinutes / 60);
  const resultMinute = Math.floor(totalMinutes % 60);

  return {
    year: resultYear,
    month: resultMonth,
    day: resultDay,
    hour: resultHour,
    minute: resultMinute,
  };
}

/**
 * 将北京时间换算为平太阳时（只做经度校正，不做均时差校正）
 * 用于一些传统排盘法中只考虑经度的情况
 */
export function toMeanSolarTime(
  year: number, month: number, day: number,
  hour: number, minute: number, longitude: number
): SolarTimeResult {
  const lonDeltaMin = longitudeDelta(longitude);
  let totalMinutes = hour * 60 + minute + lonDeltaMin;

  let resultDay = day;
  let resultMonth = month;
  let resultYear = year;

  while (totalMinutes < 0) {
    totalMinutes += 1440;
    const prev = new Date(year, month - 1, day - 1);
    resultYear = prev.getFullYear();
    resultMonth = prev.getMonth() + 1;
    resultDay = prev.getDate();
  }

  while (totalMinutes >= 1440) {
    totalMinutes -= 1440;
    const next = new Date(year, month - 1, day + 1);
    resultYear = next.getFullYear();
    resultMonth = next.getMonth() + 1;
    resultDay = next.getDate();
  }

  return {
    year: resultYear,
    month: resultMonth,
    day: resultDay,
    hour: Math.floor(totalMinutes / 60),
    minute: Math.floor(totalMinutes % 60),
  };
}
