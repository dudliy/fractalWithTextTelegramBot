require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

// Токен из .env
const token = process.env.TOKEN;
if (!token) {
  console.error('Не найден TOKEN в .env');
  process.exit(1);
}

// Создаём бота
const bot = new TelegramBot(token, { polling: true });

// Функция для генерации случайного имени файла 01.png–40.png
function getRandomImagePath() {
  const num = Math.floor(Math.random() * 40) + 1; // 1–40
  const padded = String(num).padStart(2, '0');    // 01, 02, ...
  return path.join(__dirname, 'png', `${padded}.png`);
}

// Основная функция, создающая изображение с переданным текстом
async function createImageWithText(userText) {
  const imgPath = getRandomImagePath();
  const image = await loadImage(imgPath);

  const width = image.width;
  const height = image.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Рисуем исходную картинку
  ctx.drawImage(image, 0, 0, width, height);

  // Параметры текста
  const fontSize = 24;
  const fontFamily = 'sans-serif';
  const lineHeight = 1.4; // множитель для высоты строки
  const maxWidth = width * 0.8; // максимальная ширина текста (80% от ширины картинки)
  const paddingX = 20;
  const paddingY = 12;
  const radius = 8;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  
  

  // Функция для разбивки текста на строки
  function wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + ' ' + word).width;
      
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  // Разбиваем текст на строки
  const lines = wrapText(userText, maxWidth - paddingX * 2);
  
  // Рассчитываем высоту блока с текстом
  const lineHeightPx = fontSize * lineHeight;
  const totalTextHeight = lines.length * lineHeightPx;
  
  // Высота подложки с учетом padding
  const boxHeight = totalTextHeight + paddingY * 2;
  const boxWidth = Math.min(
    // Находим максимальную ширину среди всех строк
    Math.max(...lines.map(line => ctx.measureText(line).width)),
    maxWidth
  ) + paddingX * 2;

  // Центрируем подложку по центру картинки
  const boxX = (width - boxWidth) / 2;
  const boxY = (height - boxHeight) / 2;

  // Рисуем подложку
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  roundRect(ctx, boxX, boxY, boxWidth, boxHeight, radius);
  ctx.fill();

  // Рисуем текст построчно
  ctx.fillStyle = '#ffffff';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const y = boxY + paddingY + (i * lineHeightPx) + (lineHeightPx / 2);
    ctx.fillText(line, width / 2, y);
  }

  return canvas.toBuffer('image/png');
}


// Вспомогательная функция для рисования скругленных прямоугольников
function roundRect(ctx, x, y, width, height, radius) {
  if (radius > width / 2) radius = width / 2;
  if (radius > height / 2) radius = height / 2;
  
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

// Обработчик /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const text =
    'Привет! Я генерирую картинки 256x256.\n\n' +
    'Отправь любой текст до 70 символов, я в ответ пришлю тебе картинку с этим текстом';
  bot.sendMessage(chatId, text);
});


// На любое другое сообщение — картинку
bot.on('message', async (msg) => {
  // Чтобы не дублировать на /start (который уже обрабатываем выше)
  if (msg.text && /^\/start/.test(msg.text)) return;
  
  // Если сообщение не содержит текста (фото, стикер и т.д.)
  if (!msg.text) {
    return bot.sendMessage(msg.chat.id, 'Пожалуйста, отправьте текст для картинки.');
  }

  const chatId = msg.chat.id;
  let userText = msg.text;  // <- получаем текст пользователя
  
  if (userText.length > 70) {
  return bot.sendMessage(chatId, 'Текст слишком длинный, максимум 70 символов.');
 }
  if (!userText || userText.trim() === '') {
  userText = 'Здесь мог быть ваш текст';
 }
 
 
  
try {
  const buffer = await createImageWithText(userText);
  
  // Отправляем с явным указанием имени файла
  // Добавляем таймаут на отправку
  await Promise.race([
    bot.sendPhoto(chatId, buffer, {
      caption: '',
      filename: 'image.png'
    }),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Таймаут отправки')), 30000)
    )
	 ]);
} catch (err) {
  console.error('Ошибка при создании изображения:', err);
  await bot.sendMessage(chatId, 'Не удалось создать картинку, попробуйте ещё раз.');
}
});
console.log('Бот запущен...');
