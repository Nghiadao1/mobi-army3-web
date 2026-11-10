import type { HeroDef } from '../types';

const classic = (id: string, name: string, title: string, pattern: HeroDef['pattern'], color: string, accent: string, skillName: string, skillDescription: string, extra: Partial<HeroDef> = {}): HeroDef => ({
  id, name, title, faction: 'army2', hp: 1000, attack: 150, armor: 8, move: 95,
  pattern, shots: 1, blast: 42, color, accent, skillName, skillDescription,
  unlockLevel: 1, sprite: `assets/army2/classic/bigImage${id.replace('army-', '')}.png`, ...extra,
});

const marvel = (id: string, name: string, title: string, pattern: HeroDef['pattern'], color: string, accent: string, skillName: string, skillDescription: string, unlockLevel: number, extra: Partial<HeroDef> = {}): HeroDef => ({
  id, name, title, faction: 'marvel', hp: 1150, attack: 175, armor: 12, move: 105,
  pattern, shots: 1, blast: 44, color, accent, skillName, skillDescription,
  unlockLevel, ...extra,
});

export const HEROES: HeroDef[] = [
  classic('army-0', 'Gunner', 'Pháo thủ', 'single', '#2563eb', '#93c5fd', 'Đại pháo', 'Đạn nổ cân bằng, phá địa hình mạnh.', { hp: 1100, blast: 50 }),
  classic('army-1', 'Miss 6', 'Xạ thủ AK', 'burst', '#db2777', '#f9a8d4', 'Điểm xạ', 'Bắn nhanh ba viên theo cùng quỹ đạo.', { shots: 3, attack: 72 }),
  classic('army-2', 'Electician', 'Chiến binh điện', 'lightning', '#7c3aed', '#c4b5fd', 'Thiên lôi', 'Sét lan qua mục tiêu và bỏ qua một phần giáp.', { shots: 2, attack: 105 }),
  classic('army-3', 'King Kong', 'Vua rừng xanh', 'spread', '#16a34a', '#bef264', 'Mưa chuối', 'Bắn chùm bốn quả chuối phủ một vùng rộng.', { shots: 4, attack: 58 }),
  classic('army-4', 'Rocketer', 'Chuyên gia rocket', 'spread', '#ea580c', '#fdba74', 'Tên lửa chùm', 'Ba rocket tách góc tạo chuỗi vụ nổ.', { shots: 3, attack: 78, blast: 38 }),
  classic('army-5', 'Granos', 'Lính lựu đạn', 'cluster', '#b45309', '#fde68a', 'Bom phân mảnh', 'Đạn mẹ tách thành ba bom con khi chạm đất.', { shots: 3, attack: 68, blast: 36 }),
  classic('army-6', 'Chicky', 'Gà chiến', 'cluster', '#ca8a04', '#fef08a', 'Trứng vàng', 'Gà bay thả trứng nổ từ trên cao.', { shots: 3, attack: 70 }),
  classic('army-7', 'Tarzan', 'Thợ săn rừng', 'boomerang', '#15803d', '#86efac', 'Boomerang', 'Đạn quay trở lại và có thể đánh hai lần.', { passive: 'ricochet', attack: 165 }),
  classic('army-8', 'Apache', 'Chiến binh búa', 'melee', '#475569', '#cbd5e1', 'Búa địa chấn', 'Cú nện thẳng tạo bán kính nổ cực lớn.', { hp: 1250, attack: 210, blast: 58 }),
  classic('army-9', 'Laser Girl', 'Nữ xạ thủ laser', 'laser', '#0891b2', '#67e8f9', 'Tia hội tụ', 'Laser bay thẳng, xuyên địa hình và mục tiêu.', { passive: 'pierce', attack: 190, blast: 25 }),

  marvel('ironman', 'Iron Man', 'Avenger tiên phong', 'burst', '#b91c1c', '#facc15', 'Jericho', 'Bốn pháo plasma liên hoàn; có thể bay tự do.', 1, { passive: 'fly', shots: 4, attack: 65 }),
  marvel('ironman-mk50', 'Iron Man Mark 50', 'Giáp nano', 'laser', '#dc2626', '#fbbf24', 'Pháo năng lượng', 'Tia năng lượng xuyên mọi vật cản.', 4, { passive: 'pierce', attack: 205 }),
  marvel('hulk', 'Hulk', 'Kẻ mạnh nhất', 'melee', '#3f8f32', '#b7f34a', 'Cú nhảy hủy diệt', 'Miễn nhiễm gió, đáp xuống gây sát thương theo độ cao.', 2, { passive: 'rage', hp: 1750, armor: 18, attack: 230, blast: 62 }),
  marvel('red-hulk', 'Red Hulk', 'Cuồng nộ đỏ', 'spread', '#b91c1c', '#fb7185', 'Xé gió', 'Sóng xung kích quét ngang chiến trường.', 6, { passive: 'rage', hp: 1650, shots: 3, attack: 90 }),
  marvel('thor', 'Thor', 'Thần sấm', 'lightning', '#2563eb', '#e2e8f0', 'Sấm sét', 'Búa gọi sét đánh xuống quanh điểm va chạm.', 2, { shots: 3, attack: 92 }),
  marvel('stormbreaker', 'Thor Stormbreaker', 'Vua Asgard', 'lightning', '#1d4ed8', '#7dd3fc', 'Bão sét tam hướng', 'Ba cột sét phủ diện rộng quanh chiếc rìu.', 7, { shots: 3, attack: 105, blast: 48 }),
  marvel('loki', 'Loki', 'Thần lừa lọc', 'single', '#166534', '#facc15', 'Giả dạng', 'Đòn đánh có cơ hội đóng băng đối thủ.', 5, { passive: 'freeze', attack: 185 }),
  marvel('doctor-strange', 'Doctor Strange', 'Phù thủy tối thượng', 'spread', '#7f1d1d', '#f59e0b', 'Lá chắn ma thuật', 'Tạo khiên hấp thụ đòn kế tiếp và bắn đĩa phép.', 5, { passive: 'shield', shots: 2, attack: 100 }),
  marvel('captain', 'Captain America', 'Đội trưởng', 'boomerang', '#1e40af', '#ef4444', 'Khiên Vibranium', 'Khiên nảy, quay về và giảm sát thương nhận vào.', 3, { passive: 'ricochet', armor: 24, attack: 175 }),
  marvel('captain-nomad', 'Captain Nomad', 'Chiến binh lưu vong', 'boomerang', '#1f2937', '#e5e7eb', 'Khiên bóng tối', 'Khiên nảy hai lần và tăng phòng thủ đồng đội.', 8, { passive: 'ricochet', armor: 26, attack: 185 }),
  marvel('captain-gold', 'Captain Hoàng Kim', 'Vệ binh hoàng gia', 'boomerang', '#b45309', '#fde047', 'Khiên hoàng kim', 'Khiên nổ ánh sáng ở điểm quay về.', 10, { passive: 'ricochet', armor: 28, attack: 195 }),
  marvel('winter-soldier', 'Winter Soldier', 'Bóng ma Hydra', 'laser', '#334155', '#ef4444', 'Đạn xuyên phá', 'Đạn bắn tỉa xuyên địa hình.', 4, { passive: 'pierce', attack: 210 }),
  marvel('winter-mark', 'Winter Soldier Mùa Đông', 'Sát thủ đánh dấu', 'laser', '#0f172a', '#60a5fa', 'Đánh dấu mục tiêu', 'Mục tiêu trúng đạn nhận thêm sát thương đến hết trận.', 9, { passive: 'mark', attack: 205 }),
  marvel('hawkeye', 'Hawk Eyes', 'Thiện xạ', 'spread', '#4c1d95', '#c084fc', 'Khóa mục tiêu', 'Bốn mũi tên tách góc săn mục tiêu.', 3, { shots: 4, attack: 62 }),
  marvel('hawkeye-tech', 'Hawk Eyes Công Nghệ', 'Cung thủ tương lai', 'burst', '#581c87', '#22d3ee', 'Phi cơ hỗ trợ', 'Mưa đạn càn quét quanh điểm chỉ định.', 8, { shots: 5, attack: 55 }),
  marvel('ultron', 'Ultron', 'Trí tuệ hủy diệt', 'burst', '#475569', '#ef4444', 'Phân thân', 'Pháo drone liên hoàn và khả năng bay.', 6, { passive: 'clone', shots: 3, attack: 78 }),
  marvel('ultron-prime', 'Ultron Tối Thượng', 'Kỷ nguyên máy móc', 'burst', '#111827', '#f97316', 'Tăng cường', 'Hấp thụ drone để hồi máu khi nguy cấp.', 12, { passive: 'clone', hp: 1450, armor: 22, shots: 4, attack: 72 }),
];

export const CLASSIC_HEROES = HEROES.filter((hero) => hero.faction === 'army2');
export const MARVEL_HEROES = HEROES.filter((hero) => hero.faction === 'marvel');
export const getHero = (id: string) => HEROES.find((hero) => hero.id === id) ?? HEROES[0];
