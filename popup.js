document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggleHighlight');
  const clearBtn = document.getElementById('clear');
  const colorPicker = document.getElementById('highlightColor');
  const status = document.getElementById('status');
  let isHighlighting = false;

  // 从存储中恢复状态
  chrome.storage.local.get(['isHighlighting', 'highlightColor'], (result) => {
    if (result.isHighlighting) {
      isHighlighting = true;
      toggleBtn.textContent = '关闭高亮模式';
      toggleBtn.classList.add('active');
      status.classList.add('active');
      status.textContent = '高亮模式已开启';
    }
    if (result.highlightColor) {
      colorPicker.value = result.highlightColor;
    }
  });

  // 检查脚本是否已注入
  async function ensureScriptsInjected(tabId) {
    try {
      // 尝试发送测试消息
      await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    } catch (error) {
      // 如果消息发送失败，注入脚本
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['content.css']
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      // 等待脚本初始化
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // 发送消息到内容脚本的函数
  async function sendMessageToContentScript(tabId, message) {
    try {
      // 确保脚本已注入
      await ensureScriptsInjected(tabId);
      
      // 发送消息
      await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    }
  }

  toggleBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab) {
        throw new Error('无法获取当前标签页');
      }

      // 检查标签页URL是否合法
      if (!tab.url || !(tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        throw new Error('此页面不支持高亮功能');
      }

      isHighlighting = !isHighlighting;
      
      if (isHighlighting) {
        toggleBtn.textContent = '关闭高亮模式';
        toggleBtn.classList.add('active');
        status.classList.add('active');
        status.textContent = '高亮模式已开启';
        status.style.backgroundColor = '';
        status.style.color = '';
        
        await sendMessageToContentScript(tab.id, {
          action: 'startHighlighting',
          color: colorPicker.value
        });
      } else {
        toggleBtn.textContent = '开启高亮模式';
        toggleBtn.classList.remove('active');
        status.classList.remove('active');
        
        await sendMessageToContentScript(tab.id, {
          action: 'stopHighlighting'
        });
      }

      // 保存状态
      chrome.storage.local.set({
        isHighlighting: isHighlighting,
        highlightColor: colorPicker.value
      });
    } catch (error) {
      console.error('无法切换高亮模式:', error);
      // 恢复按钮状态
      isHighlighting = !isHighlighting;
      toggleBtn.textContent = isHighlighting ? '关闭高亮模式' : '开启高亮模式';
      toggleBtn.classList.toggle('active', isHighlighting);
      status.textContent = error.message || '操作失败，请刷新页面重试';
      status.style.backgroundColor = '#ffebee';
      status.style.color = '#c62828';
      status.classList.add('active');
    }
  });

  colorPicker.addEventListener('change', async () => {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab) {
        throw new Error('无法获取当前标签页');
      }
      
      await sendMessageToContentScript(tab.id, {
        action: 'updateColor',
        color: colorPicker.value
      });

      // 保存颜色设置
      chrome.storage.local.set({
        highlightColor: colorPicker.value
      });
    } catch (error) {
      console.error('无法更新颜色:', error);
      status.textContent = '更新颜色失败';
      status.style.backgroundColor = '#ffebee';
      status.style.color = '#c62828';
      status.classList.add('active');
    }
  });

  clearBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab) {
        throw new Error('无法获取当前标签页');
      }
      
      await sendMessageToContentScript(tab.id, {
        action: 'clearHighlights'
      });
    } catch (error) {
      console.error('无法清除高亮:', error);
      status.textContent = '清除高亮失败';
      status.style.backgroundColor = '#ffebee';
      status.style.color = '#c62828';
      status.classList.add('active');
    }
  });
}); 