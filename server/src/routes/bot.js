const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只允許上傳Excel文件 (.xlsx, .xls)'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Parse Excel response guide
const parseResponseGuide = (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('Excel raw data:', JSON.stringify(data.slice(0, 3), null, 2));
    console.log('Available columns:', Object.keys(data[0] || {}));
    
    // Expected format with new structure: 類型, 範例, 回覆種類, 回覆範本
    const responseGuide = data.map((row, index) => {
      const item = {
        type: row['類型'] || row['Type'] || row['type'] || row['category'] || row['Category'],
        example: row['範例'] || row['Example'] || row['example'] || row['sample'] || row['Sample'],
        replyType: row['回覆種類'] || row['Reply Type'] || row['replyType'] || row['response_type'] || row['ResponseType'],
        template: row['回覆範本'] || row['Reply Template'] || row['template'] || row['response'] || row['Response']
      };
      
      console.log(`Row ${index + 1}:`, item);
      
      // Check if all required fields are present
      const isValid = item.type && item.example && item.replyType && item.template;
      if (!isValid) {
        console.log(`Row ${index + 1} rejected - missing fields:`, {
          type: !!item.type,
          example: !!item.example,
          replyType: !!item.replyType,
          template: !!item.template
        });
      }
      
      return item;
    }).filter(item => item.type && item.example && item.replyType && item.template);
    
    console.log(`Total rows processed: ${data.length}, Valid rows: ${responseGuide.length}`);
    
    return responseGuide;
  } catch (error) {
    console.error('Excel parsing error:', error);
    throw new Error(`Excel解析失敗: ${error.message}`);
  }
};

// Scrape Facebook post comments
const scrapeFacebookComments = async (postUrls) => {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    const allComments = [];
    for (const url of postUrls) {
      try {
        console.log(`正在爬取: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for comments to load
        await page.waitForTimeout(3000);
        
        // Try to expand comments by clicking "查看更多留言" or similar buttons
        try {
          await page.click('[data-testid="post-comments-expand-button"]');
          await page.waitForTimeout(2000);
        } catch (e) {
          // Button might not exist, continue
        }
        
        // Extract comments
        const comments = await page.evaluate(() => {
          const commentElements = document.querySelectorAll('[data-testid="comment"]');
          const comments = [];
          
          commentElements.forEach(element => {
            const authorElement = element.querySelector('[data-testid="comment-author"]');
            const textElement = element.querySelector('[data-testid="comment-text"]');
            
            if (authorElement && textElement) {
              comments.push({
                author: authorElement.textContent.trim(),
                text: textElement.textContent.trim(),
                timestamp: new Date().toISOString()
              });
            }
          });
          
          return comments;
        });
        
        allComments.push({
          postUrl: url,
          comments: comments
        });
        
      } catch (error) {
        console.error(`無法爬取 ${url}: ${error.message}`);
        allComments.push({
          postUrl: url,
          comments: [],
          error: error.message
        });
      }
    }
    
    return allComments;
  } catch (error) {
    console.error('Facebook scraping error:', error);
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Failed to close browser:', closeError);
      }
    }
  }
};

// Classify comment based on content analysis
const classifyComment = (commentText) => {
  // Don't use toLowerCase() for Chinese text - it doesn't work properly
  const text = commentText;
  
  // Category detection patterns
  const patterns = {
    'A': {
      keywords: ['缺貨', '沒有', '賣完', '沒現貨', '什麼時候有', '有貨嗎', '還有嗎', '買不到'],
      description: '商品賣不到 / 缺貨'
    },
    'B': {
      keywords: ['規格', '尺寸', '顏色', '多少錢', '價格', '怎麼買', '價位', '材質', '怎麼訂'],
      description: '商品規格詢問'
    },
    'C': {
      keywords: ['活動', '怎麼參加', '解法', '方法', '如何', '規則', '抽獎', '參加'],
      description: '活動參加 / 解法詢問'
    },
    'D': {
      keywords: ['讚', '好棒', '厲害', '喜歡', '太棒了', '支持', '加油', '👍', '❤️', '🔥'],
      description: '稱讚 / 互動'
    },
    'E': {
      keywords: ['爛', '差', '不好', '糟糕', '騙人', '垃圾', '難用', '後悔', '退貨', '不推薦'],
      description: '負面評論 / 抱怨'
    },
    'F': {
      keywords: ['幹', '操', '靠', '白癡', '智障', '死', '滾', '低能', '白痴', '混蛋'],
      description: '攻擊 / 黑人 / 不雅詞彙'
    },
    'G': {
      keywords: ['@', '標記', '朋友', '看看', '哈哈', '笑死', '😂', '🤣', '😭'],
      description: 'Tag 朋友 / 認識 / 開玩笑'
    },
    'H': {
      keywords: ['😍', '😘', '🥰', '😊', '😄', '😆', '🤔', '😴', '🙄'],
      description: '無意義留言 / 表情符號 / 貼圖'
    },
    'I': {
      keywords: ['line', 'http', 'www', '.com', 'ig', 'facebook', 'fb', '連結', '加line'],
      description: '廣告 / Spam / 連結'
    },
    'J': {
      keywords: ['hello', 'thank', 'good', 'nice', 'love', 'great', 'awesome', 'amazing'],
      description: '英文 / 非中文留言'
    }
  };
  
  // Check for English content (non-Chinese characters)
  const chineseRegex = /[\u4e00-\u9fff]/;
  const englishRegex = /[a-zA-Z]/;
  if (englishRegex.test(text) && !chineseRegex.test(text)) {
    return 'J';
  }
  
  // Check for emoji-only content
  const emojiRegex = /^[\s\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/u;
  if (emojiRegex.test(text)) {
    return 'H';
  }
  
  // Check for @ mentions
  if (text.includes('@')) {
    return 'G';
  }
  
  // Check other patterns
  for (const [category, pattern] of Object.entries(patterns)) {
    if (pattern.keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }
  
  return 'H'; // Default to meaningless comment
};

// Generate responses based on response guide
const generateResponses = (comments, responseGuide) => {
  const processedComments = [];
  
  comments.forEach(postData => {
    postData.comments.forEach(comment => {
      // Classify the comment
      const category = classifyComment(comment.text);
      
      // Find matching response guide for this category
      const matchingGuide = responseGuide.find(guide => 
        guide.type === category || guide.type.includes(category)
      );
      
      let suggestedResponse = '無匹配回覆';
      let replyType = '不回覆';
      
      if (matchingGuide) {
        suggestedResponse = matchingGuide.template;
        replyType = matchingGuide.replyType;
      }
      
      processedComments.push({
        貼文連結: postData.postUrl,
        留言者: comment.author,
        留言內容: comment.text,
        時間: comment.timestamp,
        分類: category,
        回覆種類: replyType,
        建議回覆: suggestedResponse
      });
    });
  });
  
  return processedComments;
};

// API Endpoints

// Upload and parse response guide
router.post('/upload-guide', upload.single('responseGuide'), (req, res) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: '請上傳Excel文件' });
    }
    
    filePath = req.file.path;
    const responseGuide = parseResponseGuide(filePath);
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      message: '回覆準則上傳成功',
      data: responseGuide
    });
  } catch (error) {
    // Clean up file even if error occurs
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.error('Failed to cleanup file:', cleanupError);
      }
    }
    res.status(400).json({ error: error.message });
  }
});

// Process posts and generate responses
router.post('/process-posts', async (req, res) => {
  try {
    const { postUrls, responseGuide } = req.body;
    
    if (!postUrls || !Array.isArray(postUrls) || postUrls.length === 0) {
      return res.status(400).json({ error: '請提供有效的貼文連結' });
    }
    
    if (!responseGuide || !Array.isArray(responseGuide) || responseGuide.length === 0) {
      return res.status(400).json({ error: '請提供有效的回覆準則' });
    }
    
    // Scrape comments
    const scrapedData = await scrapeFacebookComments(postUrls);
    
    // Generate responses
    const processedComments = generateResponses(scrapedData, responseGuide);
    
    // Create Excel file
    const worksheet = XLSX.utils.json_to_sheet(processedComments);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '留言回覆');
    
    // Save to temporary file
    const outputDir = path.join(__dirname, '../../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const fileName = `facebook-responses-${Date.now()}.xlsx`;
    const filePath = path.join(outputDir, fileName);
    XLSX.writeFile(workbook, filePath);
    
    res.json({
      success: true,
      message: '處理完成',
      data: {
        totalComments: processedComments.length,
        fileName: fileName,
        downloadUrl: `/api/bot/download/${fileName}`
      }
    });
    
  } catch (error) {
    console.error('處理貼文時出錯:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download generated Excel file
router.get('/download/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  
  // Security: Prevent path traversal attacks
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return res.status(400).json({ error: '無效的文件名稱' });
  }
  
  // Security: Only allow Excel files
  if (!fileName.match(/^facebook-responses-\d+\.xlsx$/)) {
    return res.status(400).json({ error: '無效的文件名稱格式' });
  }
  
  const filePath = path.join(__dirname, '../../output', fileName);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' });
  }
  
  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('下載錯誤:', err);
      res.status(500).json({ error: '下載失敗' });
    }
  });
});

module.exports = router; 