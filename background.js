// 监听标签页更新
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    try {
      // 检查高亮状态
      const result = await chrome.storage.local.get(['isHighlighting', 'highlightColor']);
      
      if (result.isHighlighting) {
        // 注入所需的CSS和JavaScript
        await chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['content.css']
        });
        
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        
        // 等待一小段时间确保脚本加载
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 发送消息以启用高亮
        await chrome.tabs.sendMessage(tabId, {
          action: 'startHighlighting',
          color: result.highlightColor || '#ffeb3b'
        });
      }
    } catch (error) {
      console.error('无法在新标签页初始化高亮功能:', error);
    }
  }
});

// 监听安装或更新事件
chrome.runtime.onInstalled.addListener(() => {
  // 初始化存储的状态
  chrome.storage.local.set({
    isHighlighting: false,
    highlightColor: '#ffeb3b'
  });
}); 