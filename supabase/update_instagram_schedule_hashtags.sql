-- Adiciona hashtags de Xiaomi, Realme + geolocalização (Petrolina-PE e Juazeiro-BA)
UPDATE instagram_schedule
SET hashtags = hashtags || ' #xiaomi #xiaomibrasil #redmi #realme #realmebrasil #petrolina #petrolinape #juazeiro #juazeirodasbahia #valesdosubmediosaofrancisco'
WHERE hashtags IS NOT NULL;

-- Se algum slot não tem hashtags ainda, inicializa com as novas
UPDATE instagram_schedule
SET hashtags = '#celular #smartphone #xiaomi #realme #petrolina #juazeiro #MercadoDoVale'
WHERE hashtags IS NULL OR hashtags = '';
