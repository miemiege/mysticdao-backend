-- MysticDAO Demo Data Seed
-- Simulates real users with diverse profiles for testing and presentation

-- ============================================================
-- 1. SUBSCRIBERS (8 users across regions)
-- ============================================================

INSERT INTO subscribers (email, phone, telegram_id, discord_id, channel, language, timezone, birth_date, birth_time, gender, interests, consent_given, consent_at, birth_longitude, birth_city, birth_minute) VALUES
('sarah.chen@email.com', '+86-138-0013-8000', NULL, NULL, 'email', 'zh', 'Asia/Shanghai', '1990-03-15', '08:30', 'female', 'bazi,fengshui,daily', 1, '2024-01-10 09:15:00', 121.47, 'Shanghai', 0),
('james.wong@proton.me', '+852-9123-4567', '@jamesfengshui', NULL, 'telegram', 'en', 'Asia/Hong_Kong', '1985-07-22', '14:45', 'male', 'fengshui,tarot', 1, '2024-02-14 11:20:00', 114.17, 'Hong Kong', 30),
('emma.li@outlook.com', '+1-415-555-0198', NULL, 'emma_li_88', 'discord', 'en', 'America/Los_Angeles', '1988-11-08', '03:15', 'female', 'bazi,meditation', 1, '2024-03-01 16:45:00', -122.42, 'San Francisco', 15),
('wei.zhang@qq.com', '+86-139-1052-7788', '@zhangwei_iching', NULL, 'telegram', 'zh', 'Asia/Shanghai', '1995-01-28', '22:00', 'male', 'iching,bazi,fengshui', 1, '2024-03-20 08:00:00', 116.41, 'Beijing', 0),
('lisa.tan@icloud.com', '+65-8123-9876', NULL, NULL, 'email', 'en', 'Asia/Singapore', '1992-05-12', '10:30', 'female', 'fengshui,daily', 1, '2024-04-05 14:30:00', 103.82, 'Singapore', 0),
('david.kim@gmail.com', '+82-10-1234-5678', '@dkim_mystic', NULL, 'telegram', 'en', 'Asia/Seoul', '1982-09-03', '06:00', 'male', 'bazi,tarot,iching', 1, '2024-04-12 10:00:00', 126.98, 'Seoul', 45),
('mei.lin@163.com', '+86-136-8888-9999', NULL, NULL, 'email', 'zh', 'Asia/Shanghai', '1998-12-19', '16:20', 'female', 'meditation,daily', 1, '2024-05-01 09:00:00', 113.26, 'Guangzhou', 0),
('alex.brown@yahoo.com', '+44-7700-900123', NULL, 'alex_b_uk', 'discord', 'en', 'Europe/London', '1979-04-25', '11:45', 'male', 'fengshui,bazi', 1, '2024-05-18 13:15:00', -0.13, 'London', 30);

-- ============================================================
-- 2. BAZI READINGS (15 records)
-- ============================================================

INSERT INTO bazi_readings (user_id, name, gender, birth_year, birth_month, birth_day, birth_hour, birth_minute, birth_longitude, birth_city, solar_adjusted, year_pillar, month_pillar, day_pillar, hour_pillar, day_master, nayin, dayun_json, xiyong, jishen, yongshen, five_elements_json, ai_interpretation, source_ip_hash, created_at) VALUES
('1', 'Sarah Chen', 'female', 1990, 3, 15, 8, 0, 121.47, 'Shanghai', 1, '庚午', '己卯', '己卯', '戊辰', '己土', '路旁土', '{"age": [3,13,23,33,43], "pillars": ["戊寅","丁丑","丙子","乙亥","甲戌"]}', '火土', '正印', '丙火', '{"wood": 22, "fire": 35, "earth": 28, "metal": 10, "water": 5}', '日主己土生于卯月，木旺土虚。喜火来生土，忌木来克土。33岁起乙亥大运，水木两旺，事业宜守不宜攻。', 'a1b2c3d4', '2024-01-15 10:30:00'),
('1', 'Sarah Chen', 'female', 1990, 3, 15, 8, 0, 121.47, 'Shanghai', 1, '庚午', '己卯', '己卯', '戊辰', '己土', '路旁土', '{"age": [3,13,23,33,43], "pillars": ["戊寅","丁丑","丙子","乙亥","甲戌"]}', '火土', '正印', '丙火', '{"wood": 22, "fire": 35, "earth": 28, "metal": 10, "water": 5}', '2024年甲辰流年，甲木正官透出，利于事业晋升。但辰土为比劫，合作需谨慎。', 'a1b2c3d4', '2024-06-20 14:00:00'),
('2', 'James Wong', 'male', 1985, 7, 22, 14, 30, 114.17, 'Hong Kong', 0, '乙丑', '癸未', '壬戌', '丁未', '壬水', '海中金', '{"age": [6,16,26,36,46], "pillars": ["壬午","辛巳","庚辰","己卯","戊寅"]}', '金水', '偏财', '庚金', '{"wood": 15, "fire": 30, "earth": 25, "metal": 18, "water": 12}', '壬水日主生于未月，土旺水弱。目前庚辰大运（26-36），金水得地，适合拓展海外业务。', 'e5f6g7h8', '2024-02-20 09:45:00'),
('3', 'Emma Li', 'female', 1988, 11, 8, 3, 15, -122.42, 'San Francisco', 0, '戊辰', '癸亥', '丁卯', '壬寅', '丁火', '大林木', '{"age": [4,14,24,34,44], "pillars": ["壬戌","辛酉","庚申","己未","戊午"]}', '木火', '偏印', '甲木', '{"wood": 30, "fire": 25, "earth": 18, "metal": 12, "water": 15}', '丁火生于亥月，水旺火熄。喜木来生火，甲木为用神。目前在庚申大运，财星太旺，投资需谨慎。', 'i9j0k1l2', '2024-03-10 11:30:00'),
('4', 'Wei Zhang', 'male', 1995, 1, 28, 22, 0, 116.41, 'Beijing', 1, '乙亥', '丁丑', '己未', '乙亥', '己土', '山头火', '{"age": [5,15,25,35,45], "pillars": ["丙子","乙亥","甲戌","癸酉","壬申"]}', '火土', '偏印', '丙火', '{"wood": 20, "fire": 32, "earth": 25, "metal": 13, "water": 10}', '己土生于丑月，土旺身强。喜木来疏土，水来润土。25岁起甲戌大运，木土交战，变动中求发展。', 'm3n4o5p6', '2024-03-25 08:15:00'),
('4', 'Wei Zhang', 'male', 1995, 1, 28, 22, 0, 116.41, 'Beijing', 1, '乙亥', '丁丑', '己未', '乙亥', '己土', '山头火', '{"age": [5,15,25,35,45], "pillars": ["丙子","乙亥","甲戌","癸酉","壬申"]}', '火土', '偏印', '丙火', '{"wood": 20, "fire": 32, "earth": 25, "metal": 13, "water": 10}', '2024甲辰年，甲木正官合身，有贵人相助。利于考试、求职、签约。', 'm3n4o5p6', '2024-07-01 16:00:00'),
('5', 'Lisa Tan', 'female', 1992, 5, 12, 10, 0, 103.82, 'Singapore', 0, '壬申', '乙巳', '戊子', '丁巳', '戊土', '剑锋金', '{"age": [2,12,22,32,42], "pillars": ["甲辰","癸卯","壬寅","辛丑","庚子"]}', '火土', '正印', '丁火', '{"wood": 18, "fire": 38, "earth": 22, "metal": 12, "water": 10}', '戊土生于巳月，火旺土相。身强喜金水，忌火土。32岁起辛丑大运，湿土晦火，运势平稳。', 'q7r8s9t0', '2024-04-15 13:20:00'),
('6', 'David Kim', 'male', 1982, 9, 3, 6, 45, 126.98, 'Seoul', 0, '壬戌', '己酉', '丁亥', '癸卯', '丁火', '大海水', '{"age": [1,11,21,31,41], "pillars": ["庚戌","辛亥","壬子","癸丑","甲寅"]}', '木火', '偏印', '甲木', '{"wood": 25, "fire": 20, "earth": 15, "metal": 18, "water": 22}', '丁火生于酉月，财旺身弱。喜木火帮身，忌金水。41岁起甲寅大运，木火通明，人生转折点。', 'u1v2w3x4', '2024-04-28 10:00:00'),
('7', 'Mei Lin', 'female', 1998, 12, 19, 16, 0, 113.26, 'Guangzhou', 0, '戊寅', '甲子', '庚子', '甲申', '庚金', '城墙土', '{"age": [8,18,28,38,48], "pillars": ["癸亥","壬戌","辛酉","庚申","己未"]}', '土金', '偏印', '戊土', '{"wood": 28, "fire": 12, "earth": 20, "metal": 25, "water": 15}', '庚金生于子月，水旺金沉。喜土来止水，金来帮身。目前在壬戌大运，食神制杀，适合学习深造。', 'y5z6a7b8', '2024-05-20 15:45:00'),
('8', 'Alex Brown', 'male', 1979, 4, 25, 11, 30, -0.13, 'London', 0, '己未', '戊辰', '壬戌', '丙午', '壬水', '天上火', '{"age": [4,14,24,34,44], "pillars": ["丁卯","丙寅","乙丑","甲子","癸亥"]}', '金水', '偏财', '庚金', '{"wood": 20, "fire": 25, "earth": 30, "metal": 15, "water": 10}', '壬水生于辰月，土旺水弱。喜金水，忌土。44岁起癸亥大运，水旺之地，晚年运势转好。', 'c9d0e1f2', '2024-05-25 09:30:00'),
('2', 'James Wong', 'male', 1985, 7, 22, 14, 30, 114.17, 'Hong Kong', 0, '乙丑', '癸未', '壬戌', '丁未', '壬水', '海中金', '{"age": [6,16,26,36,46], "pillars": ["壬午","辛巳","庚辰","己卯","戊寅"]}', '金水', '偏财', '庚金', '{"wood": 15, "fire": 30, "earth": 25, "metal": 18, "water": 12}', '2024甲辰年，甲木食神透出，利于才华展现。辰为水库，财库打开，收入有望增长。', 'e5f6g7h8', '2024-08-10 11:00:00'),
('3', 'Emma Li', 'female', 1988, 11, 8, 3, 15, -122.42, 'San Francisco', 0, '戊辰', '癸亥', '丁卯', '壬寅', '丁火', '大林木', '{"age": [4,14,24,34,44], "pillars": ["壬戌","辛酉","庚申","己未","戊午"]}', '木火', '偏印', '甲木', '{"wood": 30, "fire": 25, "earth": 18, "metal": 12, "water": 15}', '2024甲辰年，甲木正印透出，利于学习新技能。但辰土伤官，注意人际关系。', 'i9j0k1l2', '2024-09-05 10:15:00'),
('5', 'Lisa Tan', 'female', 1992, 5, 12, 10, 0, 103.82, 'Singapore', 0, '壬申', '乙巳', '戊子', '丁巳', '戊土', '剑锋金', '{"age": [2,12,22,32,42], "pillars": ["甲辰","癸卯","壬寅","辛丑","庚子"]}', '火土', '正印', '丁火', '{"wood": 18, "fire": 38, "earth": 22, "metal": 12, "water": 10}', '2024甲辰年，甲木七杀透出，事业有压力也有动力。辰为财库，理财有道。', 'q7r8s9t0', '2024-10-01 14:30:00'),
('6', 'David Kim', 'male', 1982, 9, 3, 6, 45, 126.98, 'Seoul', 0, '壬戌', '己酉', '丁亥', '癸卯', '丁火', '大海水', '{"age": [1,11,21,31,41], "pillars": ["庚戌","辛亥","壬子","癸丑","甲寅"]}', '木火', '偏印', '甲木', '{"wood": 25, "fire": 20, "earth": 15, "metal": 18, "water": 22}', '2024甲辰年，甲木正印合身，贵人运强。辰酉合金，财星有源，合作生财。', 'u1v2w3x4', '2024-10-20 09:00:00'),
('8', 'Alex Brown', 'male', 1979, 4, 25, 11, 30, -0.13, 'London', 0, '己未', '戊辰', '壬戌', '丙午', '壬水', '天上火', '{"age": [4,14,24,34,44], "pillars": ["丁卯","丙寅","乙丑","甲子","癸亥"]}', '金水', '偏财', '庚金', '{"wood": 20, "fire": 25, "earth": 30, "metal": 15, "water": 10}', '2024甲辰年，甲木食神制杀，事业突破之年。辰戌冲，注意健康，特别是肠胃。', 'c9d0e1f2', '2024-11-15 11:45:00');

-- ============================================================
-- 3. FENGSHUI READINGS (10 records)
-- ============================================================

INSERT INTO fengshui_readings (user_id, room_type, room_shape, orientation, birth_year, gender, minggua_name, minggua_number, direction_luck_json, color_scheme_json, layout_advice_json, ai_interpretation, source_ip_hash, created_at) VALUES
('1', 'Living Room', 'rectangular', 'south', 1990, 'female', '坤', 2, '{"shengqi": "northeast", "tianyi": "west", "yanian": "northwest", "fuyin": "southwest"}', '{"primary": ["yellow", "brown"], "accent": ["beige", "terracotta"], "avoid": ["green", "blue"]}', '{"sofa": "背靠实墙，面向门窗", "tv": "避免正对大门", "plant": "发财树放东南角", "water": "小型喷泉放北方"}', '坤命女命，客厅坐南朝北。生气在东北，宜开门窗纳气。天医在西方，沙发靠西墙有利健康。', 'a1b2c3d4', '2024-02-01 10:00:00'),
('2', 'Office', 'square', 'east', 1985, 'male', '乾', 6, '{"shengqi": "west", "tianyi": "northeast", "yanian": "southwest", "fuyin": "northwest"}', '{"primary": ["white", "silver"], "accent": ["gold", "bronze"], "avoid": ["red", "purple"]}', '{"desk": "坐东朝西，背靠实墙", "shelf": "金属书架放西方", "plant": "仙人掌化煞放窗边", "light": "暖白光台灯放左手边"}', '乾命男命，办公室坐东朝西。生气在西方，办公桌面向西方有利事业发展。金属材质增强运势。', 'e5f6g7h8', '2024-03-05 14:30:00'),
('3', 'Bedroom', 'rectangular', 'southwest', 1988, 'female', '震', 3, '{"shengqi": "south", "tianyi": "north", "yanian": "southeast", "fuyin": "east"}', '{"primary": ["green", "teal"], "accent": ["wood", "cream"], "avoid": ["white", "metal"]}', '{"bed": "床头靠南墙，脚朝北", "mirror": "避免正对床", "plant": "绿萝放东南角", "color": "浅绿床品助眠"}', '震命女命，卧室坐西南朝东北。生气在南方，床头靠南墙纳生气。木色床品增强木气，利于感情运。', 'i9j0k1l2', '2024-04-12 09:15:00'),
('4', 'Entrance', 'irregular', 'north', 1995, 'male', '巽', 4, '{"shengqi": "north", "tianyi": "east", "yanian": "south", "fuyin": "southeast"}', '{"primary": ["green", "blue"], "accent": ["black", "navy"], "avoid": ["yellow", "brown"]}', '{"door": "门槛下埋五帝钱", "shoe": "鞋柜放东侧，门关遮挡", "mirror": "圆形镜放南方", "plant": "富贵竹放门口"}', '巽命男命，大门朝北。生气在北方，大门本身纳生气。门槛埋五帝钱挡煞，鞋柜必须带门。', 'm3n4o5p6', '2024-05-18 16:00:00'),
('5', 'Kitchen', 'square', 'southeast', 1992, 'female', '艮', 8, '{"shengqi": "southwest", "tianyi": "northwest", "yanian": "west", "fuyin": "northeast"}', '{"primary": ["yellow", "beige"], "accent": ["brown", "terracotta"], "avoid": ["green", "blue"]}', '{"stove": "坐凶向吉，面向西南", "sink": "避免与灶台相对", "fridge": "放西北角", "color": "米黄色瓷砖"}', '艮命女命，厨房坐东南朝西北。灶向西南生气方，米黄色瓷砖增强土气。冰箱放西北天医位有利健康。', 'q7r8s9t0', '2024-06-22 11:30:00'),
('1', 'Bedroom', 'rectangular', 'west', 1990, 'female', '坤', 2, '{"shengqi": "northeast", "tianyi": "west", "yanian": "northwest", "fuyin": "southwest"}', '{"primary": ["yellow", "gold"], "accent": ["cream", "peach"], "avoid": ["green", "wood"]}', '{"bed": "床头靠东北墙", "window": "西窗挂厚窗帘挡煞", "art": "成双成对的装饰画", "light": "暖黄光床头灯"}', '坤命女命二次布局，卧室坐西朝东。西为延年方，适合休息养生。成双装饰有利感情。', 'a1b2c3d4', '2024-08-05 10:45:00'),
('6', 'Living Room', 'L-shaped', 'northwest', 1982, 'male', '乾', 6, '{"shengqi": "west", "tianyi": "northeast", "yanian": "southwest", "fuyin": "northwest"}', '{"primary": ["white", "gray"], "accent": ["silver", "gold"], "avoid": ["red", "fire"]}', '{"sofa": "L型沙发靠西南墙", "tv": "放西方，面向东南", "metal": "铜风铃挂西方", "water": "避免放北方"}', '乾命男命，客厅坐西北朝东南。L型户型需注意缺角，铜风铃化解西方煞气。金属装饰增强运势。', 'u1v2w3x4', '2024-09-10 15:00:00'),
('7', 'Office', 'rectangular', 'south', 1998, 'female', '震', 3, '{"shengqi": "south", "tianyi": "north", "yanian": "southeast", "fuyin": "east"}', '{"primary": ["green", "blue"], "accent": ["wood", "black"], "avoid": ["white", "gold"]}', '{"desk": "坐南朝北", "computer": "屏幕不对门", "plant": "文竹放左手边", "water": "小型水景放北方"}', '震命女命，办公室坐南朝北。文竹增强文昌运，北方放小型水景利智慧。绿色桌垫助专注。', 'y5z6a7b8', '2024-10-15 09:30:00'),
('8', 'Kitchen', 'rectangular', 'northeast', 1979, 'male', '离', 9, '{"shengqi": "east", "tianyi": "southeast", "yanian": "north", "fuyin": "south"}', '{"primary": ["red", "purple"], "accent": ["green", "wood"], "avoid": ["black", "blue"]}', '{"stove": "坐南向北，面向北方", "color": "红色小家电增火气", "light": "充足照明，避免阴暗", "plant": "小型香草放窗台"}', '离命男命，厨房坐东北朝西南。灶向北方，红色小家电增强火气。充足照明对离命至关重要。', 'c9d0e1f2', '2024-11-01 13:15:00'),
('4', 'Living Room', 'rectangular', 'east', 1995, 'male', '巽', 4, '{"shengqi": "north", "tianyi": "east", "yanian": "south", "fuyin": "southeast"}', '{"primary": ["green", "teal"], "accent": ["blue", "black"], "avoid": ["yellow", "metal"]}', '{"sofa": "背靠东墙，面向西", "plant": "大型绿植放东南", "water": "鱼缸放北方", "wind": "木质风铃挂门口"}', '巽命男命二次布局，客厅坐东朝西。大型绿植放东南增强木气，鱼缸放北方旺财。', 'm3n4o5p6', '2024-12-10 10:00:00');

-- ============================================================
-- 4. READING HISTORY (12 records)
-- ============================================================

INSERT INTO reading_history (user_id, session_id, reading_type, input_params_json, result_summary, reading_id, source_ip_hash, created_at) VALUES
('1', 'sess_001', 'bazi', '{"name": "Sarah Chen", "birth": "1990-03-15 08:30", "gender": "female"}', '己土日主，喜火土，33岁乙亥大运事业宜守', 1, 'a1b2c3d4', '2024-01-15 10:30:00'),
('1', 'sess_002', 'fengshui', '{"room": "Living Room", "orientation": "south"}', '坤命客厅朝南，生气在东北，宜开门窗纳气', 1, 'a1b2c3d4', '2024-02-01 10:00:00'),
('1', 'sess_003', 'daily', '{"date": "2024-06-20"}', '今日卦象：乾为天，宜主动出击，不利保守', NULL, 'a1b2c3d4', '2024-06-20 08:00:00'),
('2', 'sess_004', 'bazi', '{"name": "James Wong", "birth": "1985-07-22 14:30", "gender": "male"}', '壬水日主，庚辰大运金水得地，宜拓展海外', 3, 'e5f6g7h8', '2024-02-20 09:45:00'),
('2', 'sess_005', 'fengshui', '{"room": "Office", "orientation": "east"}', '乾命办公室坐东朝西，生气在西方，金属装饰增强', 2, 'e5f6g7h8', '2024-03-05 14:30:00'),
('3', 'sess_006', 'bazi', '{"name": "Emma Li", "birth": "1988-11-08 03:15", "gender": "female"}', '丁火日主，庚申大运财星太旺，投资需谨慎', 4, 'i9j0k1l2', '2024-03-10 11:30:00'),
('3', 'sess_007', 'daily', '{"date": "2024-09-05"}', '今日卦象：坤为地，宜静不宜动，修身养性', NULL, 'i9j0k1l2', '2024-09-05 08:30:00'),
('4', 'sess_008', 'bazi', '{"name": "Wei Zhang", "birth": "1995-01-28 22:00", "gender": "male"}', '己土日主，甲戌大运木土交战，变动中求发展', 5, 'm3n4o5p6', '2024-03-25 08:15:00'),
('4', 'sess_009', 'fengshui', '{"room": "Entrance", "orientation": "north"}', '巽命大门朝北，门槛埋五帝钱，鞋柜带门', 4, 'm3n4o5p6', '2024-05-18 16:00:00'),
('5', 'sess_010', 'fengshui', '{"room": "Kitchen", "orientation": "southeast"}', '艮命厨房坐东南，灶向西南，米黄瓷砖增强土气', 5, 'q7r8s9t0', '2024-06-22 11:30:00'),
('6', 'sess_011', 'bazi', '{"name": "David Kim", "birth": "1982-09-03 06:45", "gender": "male"}', '丁火日主，甲寅大运木火通明，人生转折点', 8, 'u1v2w3x4', '2024-04-28 10:00:00'),
('8', 'sess_012', 'bazi', '{"name": "Alex Brown", "birth": "1979-04-25 11:30", "gender": "male"}', '壬水日主，癸亥大运水旺，晚年运势转好', 10, 'c9d0e1f2', '2024-05-25 09:30:00');

-- ============================================================
-- 5. USER FAVORITES (8 records)
-- ============================================================

INSERT INTO user_favorites (user_id, fav_type, reading_id, title, note, created_at) VALUES
('1', 'bazi', 1, 'Sarah 八字命盘', '我的本命盘，常看', '2024-01-16 09:00:00'),
('1', 'fengshui', 1, '上海客厅风水', '搬家前的布局参考', '2024-02-02 11:00:00'),
('2', 'bazi', 3, 'James 2024流年', '甲辰年运势分析', '2024-08-11 10:00:00'),
('3', 'bazi', 4, 'Emma 庚申大运', '投资前必看', '2024-03-11 14:00:00'),
('4', 'bazi', 5, 'Wei Zhang 命局', '甲戌大运变动期', '2024-03-26 09:00:00'),
('4', 'fengshui', 4, '北京大门风水', '五帝钱布局方案', '2024-05-19 10:00:00'),
('6', 'bazi', 8, 'David Kim 甲寅大运', '转折点计划', '2024-04-29 11:00:00'),
('8', 'bazi', 10, 'Alex 癸亥大运', '退休规划参考', '2024-05-26 09:00:00');

-- ============================================================
-- 6. FEEDBACK RATINGS (10 records)
-- ============================================================

INSERT INTO feedback_ratings (user_id, reading_type, reading_id, rating, comment, tags, source_ip_hash, created_at) VALUES
('1', 'bazi', 1, 5, '非常准确！事业建议很有用，已经按照建议调整了工作方向。', 'accurate,helpful,career', 'a1b2c3d4', '2024-01-16 10:00:00'),
('1', 'fengshui', 1, 4, '客厅布局调整后，家人关系确实改善了不少。', 'fengshui,layout,family', 'a1b2c3d4', '2024-02-03 09:30:00'),
('2', 'bazi', 3, 5, '海外拓展的建议太及时了，已经签下新加坡客户。', 'business,overseas,timing', 'e5f6g7h8', '2024-08-12 14:00:00'),
('3', 'bazi', 4, 4, '投资谨慎的建议帮我避开了股市大跌，感谢！', 'investment,warning,timely', 'i9j0k1l2', '2024-03-12 13:00:00'),
('4', 'bazi', 5, 5, '变动中求发展说得很好，我换了工作，薪资涨了40%。', 'career,change,salary', 'm3n4o5p6', '2024-07-02 10:00:00'),
('5', 'fengshui', 5, 4, '厨房灶向调整后，做饭心情好多了，神奇。', 'kitchen,mood,daily', 'q7r8s9t0', '2024-06-23 10:00:00'),
('6', 'bazi', 8, 5, '甲寅大运的转折点说中了，今年确实升职了。', 'promotion,career,accurate', 'u1v2w3x4', '2024-11-01 09:00:00'),
('7', 'bazi', 9, 4, '学习深造的建议很对，今年考上了研究生。', 'education,study,success', 'y5z6a7b8', '2024-11-01 10:00:00'),
('8', 'bazi', 10, 5, '晚年运势转好给了我很大信心，开始规划退休生活。', 'retirement,planning,hope', 'c9d0e1f2', '2024-12-01 11:00:00'),
('2', 'fengshui', 2, 4, '办公室金属书架装好后，工作效率提升明显。', 'office,productivity,metal', 'e5f6g7h8', '2024-09-11 15:00:00');

-- ============================================================
-- 7. DAILY STATS (6 months aggregated)
-- ============================================================

INSERT INTO daily_stats (date, total_requests, unique_visitors, api_calls, avg_response_time_ms, error_count, premium_views) VALUES
('2024-07-01', 1240, 320, 890, 145, 12, 45),
('2024-07-15', 1580, 410, 1120, 132, 8, 62),
('2024-08-01', 1890, 520, 1350, 128, 15, 78),
('2024-08-15', 2100, 580, 1480, 125, 10, 95),
('2024-09-01', 2350, 640, 1680, 118, 7, 110),
('2024-09-15', 2580, 710, 1820, 115, 9, 128),
('2024-10-01', 2800, 780, 1980, 112, 11, 145),
('2024-10-15', 3100, 850, 2200, 108, 6, 162),
('2024-11-01', 3350, 920, 2380, 105, 8, 180),
('2024-11-15', 3600, 980, 2550, 102, 5, 195),
('2024-12-01', 3900, 1050, 2780, 98, 7, 210),
('2025-01-01', 4200, 1120, 2980, 95, 4, 235);

-- ============================================================
-- 8. API USAGE (current endpoints)
-- ============================================================

INSERT INTO api_usage (endpoint, call_count, error_count, total_response_time_ms, last_called_at) VALUES
('/api/bazi', 4520, 45, 542400, '2025-01-15 10:30:00'),
('/api/fengshui', 3180, 32, 381600, '2025-01-15 11:00:00'),
('/api/daily', 2890, 12, 144500, '2025-01-15 08:00:00'),
('/api/iching', 1560, 18, 218400, '2025-01-14 22:00:00'),
('/api/compat', 980, 8, 137200, '2025-01-14 19:30:00'),
('/api/user/favorites', 1240, 5, 86800, '2025-01-15 09:15:00'),
('/api/user/history', 890, 3, 71200, '2025-01-15 09:10:00'),
('/api/feedback', 450, 2, 45000, '2025-01-14 16:00:00')
ON CONFLICT(endpoint) DO UPDATE SET
  call_count = call_count + excluded.call_count,
  error_count = error_count + excluded.error_count,
  total_response_time_ms = total_response_time_ms + excluded.total_response_time_ms,
  last_called_at = excluded.last_called_at;

-- ============================================================
-- 9. CONTENT CACHE (daily readings)
-- ============================================================

INSERT INTO content_cache (content_type, language, date, title, body, tags, published, published_at) VALUES
('daily', 'zh', '2025-01-15', '今日运势：乾为天', '今日卦象乾为天，刚健有力。事业方面宜主动出击，不宜守成。财运亨通，但需防小人。感情上单身的有机会遇到心仪对象。', 'daily,fortune,qian', 1, '2025-01-15 06:00:00'),
('daily', 'en', '2025-01-15', 'Daily Fortune: Qian (Heaven)', 'Today''s hexagram is Qian, symbolizing creative power. Take initiative in career matters. Financial luck is strong but watch for petty people.', 'daily,fortune,qian', 1, '2025-01-15 06:00:00'),
('daily', 'zh', '2025-01-14', '今日运势：坤为地', '今日卦象坤为地，柔顺包容。宜静不宜动，修身养性。工作中多听取他人意见，不宜独断。感情中多包容对方。', 'daily,fortune,kun', 1, '2025-01-14 06:00:00'),
('daily', 'en', '2025-01-14', 'Daily Fortune: Kun (Earth)', 'Today''s hexagram is Kun, symbolizing receptivity. Stay calm and cultivate yourself. Listen more and decide less at work.', 'daily,fortune,kun', 1, '2025-01-14 06:00:00'),
('article', 'zh', '2025-01-10', '2025乙巳年运势总览', '2025年为乙巳年，木火通明。属鼠、猴、鸡的朋友运势较佳；属猪、虎的朋友需注意健康...', 'yearly,2025,forecast', 1, '2025-01-10 10:00:00'),
('article', 'en', '2025-01-10', '2025 Yi-Si Year Forecast', '2025 is the Yi-Si year, wood and fire in harmony. Rat, Monkey, and Rooster signs have strong fortune...', 'yearly,2025,forecast', 1, '2025-01-10 10:00:00');

-- ============================================================
-- 10. COMPLIANCE LOG (audit trail)
-- ============================================================

INSERT INTO compliance_log (event_type, user_id, ip_hash, details, created_at) VALUES
('consent_given', '1', 'a1b2c3d4', 'User consented to data processing via email signup', '2024-01-10 09:15:00'),
('data_export_request', '1', 'a1b2c3d4', 'User requested full data export', '2024-06-01 14:00:00'),
('consent_given', '2', 'e5f6g7h8', 'User consented via Telegram bot', '2024-02-14 11:20:00'),
('unsubscribe', '7', 'y5z6a7b8', 'User unsubscribed from daily emails', '2024-11-01 08:00:00'),
('data_deletion_request', NULL, 'z9a0b1c2', 'Anonymous user requested IP log deletion', '2024-12-15 16:00:00');
