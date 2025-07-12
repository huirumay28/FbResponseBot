import React, { useState } from 'react';
import './App.css';

interface ResponseGuideItem {
  type: string;
  example: string;
  replyType: string;
  template: string;
}

function App() {
  const [responseGuide, setResponseGuide] = useState<File | null>(null);
  const [responseGuideData, setResponseGuideData] = useState<ResponseGuideItem[]>([]);
  const [postLinks, setPostLinks] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file extension and MIME type more accurately
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/excel'
    ];
    const allowedExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      alert('請上傳Excel文件 (.xlsx 或 .xls)');
      return;
    }

    setResponseGuide(file);
    setUploadStatus('上傳中...');

    try {
      const formData = new FormData();
      formData.append('responseGuide', file);

      const response = await fetch('/api/bot/upload-guide', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        setResponseGuideData(result.data);
        setUploadStatus(`上傳成功！解析到 ${result.data.length} 條回覆準則`);
      } else {
        throw new Error(result.error || '上傳失敗');
      }
    } catch (error) {
      console.error('上傳錯誤:', error);
      setUploadStatus('上傳失敗，請檢查文件格式');
      setResponseGuide(null);
      setResponseGuideData([]);
    }
  };

  const handleGenerateResponse = async () => {
    if (!responseGuide || !postLinks.trim()) {
      alert('請先上傳留言準則並輸入貼文連結');
      return;
    }

    if (responseGuideData.length === 0) {
      alert('回覆準則解析失敗，請重新上傳');
      return;
    }

    setIsProcessing(true);

    try {
      // Parse post URLs from textarea
      const postUrls = postLinks
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      if (postUrls.length === 0) {
        throw new Error('請輸入至少一個貼文連結');
      }

      const requestBody = {
        postUrls,
        responseGuide: responseGuideData
      };

      const response = await fetch('/api/bot/process-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (response.ok) {
        // Download the generated Excel file
        const downloadUrl = result.data.downloadUrl;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = result.data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert(`處理完成！共處理了 ${result.data.totalComments} 條留言`);
      } else {
        throw new Error(result.error || '處理失敗');
      }
    } catch (error) {
      console.error('處理錯誤:', error);
      alert(`處理失敗: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetResponseGuide = () => {
    setResponseGuide(null);
    setResponseGuideData([]);
    setUploadStatus('');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Facebook 留言回覆機器人</h1>
        <p>自動讀取貼文留言並生成回覆</p>
      </header>

      <main className="app-main">
        <div className="action-cards">
          {/* Response Guide Section */}
          <div className="action-card">
            <div className="card-header">
              <h3>留言準則</h3>
              <p>上傳回覆準則Excel文件</p>
            </div>
            <div className="card-content">
              <div className="format-info">
                <div className="format-header">
                  <span>📋 Excel格式要求</span>
                </div>
                <div className="format-details">
                  <p>您的Excel文件必須包含以下四個欄位：</p>
                  <ul>
                    <li><strong>類型</strong> - 留言分類 (如: A, B, C等)</li>
                    <li><strong>範例</strong> - 留言範例文字</li>
                    <li><strong>回覆種類</strong> - 回覆類型 (如: 回覆, 不回覆, 隱藏等)</li>
                    <li><strong>回覆範本</strong> - 具體的回覆內容</li>
                  </ul>
                  <p className="format-note">💡 所有欄位都必須填寫，空白行將被忽略</p>
                </div>
              </div>
              
              <div className="upload-area">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  id="excel-upload"
                  className="file-input"
                />
                <label htmlFor="excel-upload" className="upload-label">
                  {responseGuide ? (
                    <div className="file-selected">
                      <span className="file-icon">📄</span>
                      <span className="file-name">{responseGuide.name}</span>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <span className="upload-icon">📤</span>
                      <span>點擊上傳Excel文件</span>
                    </div>
                  )}
                </label>
              </div>
              
              {uploadStatus && (
                <div className={`upload-status ${responseGuideData.length > 0 ? 'success' : 'error'}`}>
                  {uploadStatus}
                </div>
              )}
              
              {responseGuideData.length > 0 && (
                <div className="guide-preview">
                  <div className="guide-header">
                    <h4>回覆準則預覽</h4>
                    <button onClick={resetResponseGuide} className="reset-button">
                      重新上傳
                    </button>
                  </div>
                  <div className="guide-list">
                    {responseGuideData.slice(0, 3).map((item, index) => (
                      <div key={index} className="guide-item">
                        <strong>{item.type}</strong> - {item.example} → {item.replyType}: {item.template}
                      </div>
                    ))}
                    {responseGuideData.length > 3 && (
                      <div className="guide-more">
                        還有 {responseGuideData.length - 3} 條準則...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Post Links Section */}
          <div className="action-card">
            <div className="card-header">
              <h3>貼文連結</h3>
              <p>輸入Facebook貼文連結</p>
            </div>
            <div className="card-content">
              <textarea
                value={postLinks}
                onChange={(e) => setPostLinks(e.target.value)}
                placeholder="請輸入Facebook貼文連結，每行一個連結&#10;例如：&#10;https://www.facebook.com/page/posts/123456789&#10;https://www.facebook.com/page/posts/987654321"
                className="links-input"
                rows={6}
              />
              <div className="links-count">
                {postLinks.split('\n').filter(line => line.trim()).length} 個連結
              </div>
            </div>
          </div>

          {/* Generate Response Section */}
          <div className="action-card">
            <div className="card-header">
              <h3>輸出回應</h3>
              <p>生成留言回覆Excel文件</p>
            </div>
            <div className="card-content">
              <button
                onClick={handleGenerateResponse}
                disabled={isProcessing || !responseGuide || !postLinks.trim() || responseGuideData.length === 0}
                className="generate-button"
              >
                {isProcessing ? (
                  <div className="processing">
                    <span className="spinner"></span>
                    <span>處理中...</span>
                  </div>
                ) : (
                  <div className="button-content">
                    <span className="button-icon">⚡</span>
                    <span>生成回覆</span>
                  </div>
                )}
              </button>
              
              <div className="process-info">
                <p>✅ 自動爬取貼文留言</p>
                <p>✅ 匹配回覆準則</p>
                <p>✅ 生成Excel回覆文件</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
