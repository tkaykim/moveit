-- 한국의 유명 댄스학원 데이터 삽입
-- 서울 10개, 각 광역시 및 서울 근교 도시 각 2개씩

-- 서울 소재 댄스학원 10개
INSERT INTO public.academies (name_kr, name_en, address, contact_number, logo_url, tags) VALUES
-- 1. 원밀리언 댄스 스튜디오
('원밀리언 댄스 스튜디오', '1MILLION Dance Studio', '서울특별시 강남구 논현로 131길 24', '02-1234-5678', NULL, 'K-POP,힙합,컨템포러리,세계적유명'),
-- 2. 저스트저크 아카데미
('저스트저크 아카데미', 'Just Jerk Academy', '서울특별시 강남구 테헤란로 123', '02-2345-6789', NULL, '힙합,스트릿댄스,크루댄스'),
-- 3. YGX
('YGX', 'YGX', '서울특별시 강남구 청담동 123-45', '02-3456-7890', NULL, 'K-POP,아이돌댄스,YG엔터테인먼트'),
-- 4. 댄스원
('댄스원', 'DANCE1', '서울특별시 강남구 역삼동 123-45', '02-4567-8901', NULL, 'K-POP,컨템포러리,재즈댄스'),
-- 5. 어반 댄스 아카데미
('어반 댄스 아카데미', 'Urban Dance Academy', '서울특별시 강남구 신사동 123-45', '02-5678-9012', NULL, '힙합,스트릿댄스,어반댄스'),
-- 6. 프리즘 댄스 스튜디오
('프리즘 댄스 스튜디오', 'PRISM Dance Studio', '서울특별시 마포구 와우산로 29길 68', '02-6789-0123', NULL, 'K-POP,힙합,재즈댄스,다양한장르'),
-- 7. 댄스플래닛
('댄스플래닛', 'Dance Planet', '서울특별시 서초구 서초대로 77길 54', '02-7890-1234', NULL, 'K-POP,컨템포러리,발레'),
-- 8. 댄스홀릭
('댄스홀릭', 'Dance Holic', '서울특별시 강남구 테헤란로 5길 11', '02-8901-2345', NULL, 'K-POP,힙합,스트릿댄스'),
-- 9. 소울 댄스 스튜디오
('소울 댄스 스튜디오', 'Soul Dance Studio', '서울특별시 강남구 압구정로 123', '02-9012-3456', NULL, '힙합,소울댄스,스트릿댄스'),
-- 10. 무브 댄스 아카데미
('무브 댄스 아카데미', 'Move Dance Academy', '서울특별시 강남구 선릉로 123', '02-0123-4567', NULL, 'K-POP,컨템포러리,모던댄스');

-- 부산광역시 댄스학원 2개
INSERT INTO public.academies (name_kr, name_en, address, contact_number, logo_url, tags) VALUES
('부산 댄스 스튜디오', 'Busan Dance Studio', '부산광역시 해운대구 센텀중앙로 97', '051-123-4567', NULL, 'K-POP,힙합,스트릿댄스'),
('해운대 댄스 아카데미', 'Haeundae Dance Academy', '부산광역시 해운대구 해운대해변로 264', '051-234-5678', NULL, 'K-POP,컨템포러리,재즈댄스');

-- 대구광역시 댄스학원 2개
INSERT INTO public.academies (name_kr, name_en, address, contact_number, logo_url, tags) VALUES
('대구 댄스 아카데미', 'Daegu Dance Academy', '대구광역시 중구 동성로 25', '053-123-4567', NULL, 'K-POP,힙합,스트릿댄스'),
('수성 댄스 스튜디오', 'Suseong Dance Studio', '대구광역시 수성구 범어로 200', '053-234-5678', NULL, 'K-POP,컨템포러리,모던댄스');

-- 인천광역시 댄스학원 2개
INSERT INTO public.academies (name_kr, name_en, address, contact_number, logo_url, tags) VALUES
('인천 댄스 센터', 'Incheon Dance Center', '인천광역시 남동구 예술로 198', '032-123-4567', NULL, 'K-POP,힙합,스트릿댄스'),
('부평 댄스 스쿨', 'Bupyeong Dance School', '인천광역시 부평구 부평대로 120', '032-234-5678', NULL, 'K-POP,컨템포러리,재즈댄스');

-- 광주광역시 댄스학원 2개
INSERT INTO public.academies (name_kr, name_en, address, contact_number, logo_url, tags) VALUES
('광주 댄스 스쿨', 'Gwangju Dance School', '광주광역시 서구 상무대로 100', '062-123-4567', NULL, 'K-POP,힙합,스트릿댄스'),
('댄스 광주', 'Dance Gwangju', '광주광역시 동구 문화전당로 38', '062-234-5678', NULL, 'K-POP,컨템포러리,모던댄스');

-- 대전광역시 댄스학원 2개
INSERT INTO public.academies (name_kr, name_en, address, contact_number, logo_url, tags) VALUES
('대전 댄스 아카데미', 'Daejeon Dance Academy', '대전광역시 서구 둔산로 50', '042-123-4567', NULL, 'K-POP,힙합,스트릿댄스'),
('유성 댄스 스튜디오', 'Yuseong Dance Studio', '대전광역시 유성구 대학로 291', '042-234-5678', NULL, 'K-POP,컨템포러리,재즈댄스');

-- 울산광역시 댄스학원 2개
INSERT INTO public.academies (name_kr, name_en, address, contact_number, logo_url, tags) VALUES
('울산 댄스 센터', 'Ulsan Dance Center', '울산광역시 남구 삼산로 200', '052-123-4567', NULL, 'K-POP,힙합,스트릿댄스'),
('댄스 울산', 'Dance Ulsan', '울산광역시 중구 태화로 150', '052-234-5678', NULL, 'K-POP,컨템포러리,모던댄스');

-- 수원시 댄스학원 2개
INSERT INTO public.academies (name_kr, name_en, address, contact_number, logo_url, tags) VALUES
('수원 댄스 스튜디오', 'Suwon Dance Studio', '경기도 수원시 팔달구 중부대로 50', '031-123-4567', NULL, 'K-POP,힙합,스트릿댄스'),
('영통 댄스 아카데미', 'Yeongtong Dance Academy', '경기도 수원시 영통구 영통로 100', '031-234-5678', NULL, 'K-POP,컨템포러리,재즈댄스');

-- 성남시 댄스학원 2개
INSERT INTO public.academies (name_kr, name_en, address, contact_number, logo_url, tags) VALUES
('성남 댄스 아카데미', 'Seongnam Dance Academy', '경기도 성남시 분당구 성남대로 300', '031-345-6789', NULL, 'K-POP,힙합,스트릿댄스'),
('분당 댄스 스튜디오', 'Bundang Dance Studio', '경기도 성남시 분당구 정자로 95', '031-456-7890', NULL, 'K-POP,컨템포러리,모던댄스');

-- 고양시 댄스학원 2개
INSERT INTO public.academies (name_kr, name_en, address, contact_number, logo_url, tags) VALUES
('고양 댄스 센터', 'Goyang Dance Center', '경기도 고양시 일산동구 중앙로 120', '031-567-8901', NULL, 'K-POP,힙합,스트릿댄스'),
('일산 댄스 스쿨', 'Ilsan Dance School', '경기도 고양시 일산서구 일산로 200', '031-678-9012', NULL, 'K-POP,컨템포러리,재즈댄스');

-- 용인시 댄스학원 2개
INSERT INTO public.academies (name_kr, name_en, address, contact_number, logo_url, tags) VALUES
('용인 댄스 아카데미', 'Yongin Dance Academy', '경기도 용인시 수지구 동천로 123', '031-789-0123', NULL, 'K-POP,힙합,스트릿댄스'),
('댄스 용인', 'Dance Yongin', '경기도 용인시 기흥구 신갈로 50', '031-890-1234', NULL, 'K-POP,컨템포러리,모던댄스');

-- 부천시 댄스학원 2개
INSERT INTO public.academies (name_kr, name_en, address, contact_number, logo_url, tags) VALUES
('부천 댄스 스튜디오', 'Bucheon Dance Studio', '경기도 부천시 원미구 부천로 150', '032-345-6789', NULL, 'K-POP,힙합,스트릿댄스'),
('소사 댄스 아카데미', 'Sosa Dance Academy', '경기도 부천시 소사구 소사로 200', '032-456-7890', NULL, 'K-POP,컨템포러리,재즈댄스');

-- 안양시 댄스학원 2개
INSERT INTO public.academies (name_kr, name_en, address, contact_number, logo_url, tags) VALUES
('안양 댄스 센터', 'Anyang Dance Center', '경기도 안양시 만안구 안양로 100', '031-901-2345', NULL, 'K-POP,힙합,스트릿댄스'),
('댄스 안양', 'Dance Anyang', '경기도 안양시 동안구 평촌대로 200', '031-012-3456', NULL, 'K-POP,컨템포러리,모던댄스');



