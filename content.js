// 全局变量声明
const globals = {
  isHighlighting: false,
  currentColor: '#ffeb3b',
  isMouseDown: false,
  startPoint: null,
  isDragging: false,
  clickStartTime: 0,
  floatingButton: null,
  colorPicker: null,
  startX: null,
  startY: null,
  initialX: null,
  initialY: null,
  isInitialized: false,
  isButtonDragging: false  // 新增：专门用于跟踪按钮拖动状态
};

// 初始化插件
function initializePlugin() {
  // 防止重复初始化
  if (document.querySelector('.floating-button')) return;
  if (globals.isInitialized) return;
  globals.isInitialized = true;

  // 创建悬浮按钮和颜色选择器
  createFloatingButton();
  
  // 从存储中恢复状态
  chrome.storage.local.get(['isHighlighting', 'highlightColor'], (result) => {
    if (result.highlightColor) {
      globals.currentColor = result.highlightColor;
      if (globals.colorPicker) {
        globals.colorPicker.querySelector('input').value = globals.currentColor;
      }
    }
    
    globals.isHighlighting = result.isHighlighting || false;
    if (globals.isHighlighting) {
      enableHighlighting();
    }
    updateFloatingButtonState();
  });
}

// 创建悬浮按钮和颜色选择器
function createFloatingButton() {
  // 确保只有一个按钮和颜色选择器
  removeExistingElements();

  // 创建悬浮按钮
  globals.floatingButton = document.createElement('button');
  globals.floatingButton.className = 'floating-button';
  globals.floatingButton.innerHTML = '🖌️';  // 使用笔刷图标
  globals.floatingButton.title = '左键点击：开启/关闭高亮功能\n右键点击：切换标记颜色\n按住拖动：调整按钮位置';
  document.body.appendChild(globals.floatingButton);

  // 创建颜色选择器容器
  globals.colorPicker = document.createElement('div');
  globals.colorPicker.className = 'highlight-color-picker';
  
  // 添加提示文本
  const tooltip = document.createElement('div');
  tooltip.className = 'color-picker-tooltip';
  tooltip.textContent = '选择高亮颜色';
  globals.colorPicker.appendChild(tooltip);
  
  // 创建颜色输入
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = globals.currentColor;
  colorInput.title = '点击选择高亮颜色';
  
  // 添加颜色变化事件
  colorInput.addEventListener('change', (e) => {
    globals.currentColor = e.target.value;
    chrome.storage.local.set({ highlightColor: globals.currentColor });
    // 更新按钮颜色提示
    globals.floatingButton.style.backgroundColor = globals.currentColor;
  });
  
  globals.colorPicker.appendChild(colorInput);
  document.body.appendChild(globals.colorPicker);

  // 恢复按钮位置
  chrome.storage.local.get(['buttonPosition', 'highlightColor'], (result) => {
    if (result.buttonPosition) {
      globals.floatingButton.style.top = result.buttonPosition.top;
      globals.floatingButton.style.right = result.buttonPosition.right;
    }
    
    // 恢复上次使用的颜色
    if (result.highlightColor) {
      globals.currentColor = result.highlightColor;
      colorInput.value = globals.currentColor;
      globals.floatingButton.style.backgroundColor = globals.currentColor;
    }
  });

  // 添加按钮事件监听器
  globals.floatingButton.addEventListener('mousedown', startDragging);
  
  // 点击切换高亮功能
  globals.floatingButton.addEventListener('click', (e) => {
    if (!globals.isDragging) {
      toggleHighlighting();
    }
  });

  // 右键点击显示颜色选择器
  globals.floatingButton.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 计算颜色选择器位置
    const rect = globals.floatingButton.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    // 根据按钮位置决定颜色选择器显示在左边还是右边
    if (rect.right + 100 > viewportWidth) {
      globals.colorPicker.style.right = 'auto';
      globals.colorPicker.style.left = (rect.left - 60) + 'px';
    } else {
      globals.colorPicker.style.left = 'auto';
      globals.colorPicker.style.right = (viewportWidth - rect.right + 20) + 'px';
    }
    
    globals.colorPicker.style.top = rect.top + 'px';
    globals.colorPicker.classList.toggle('show');
  });

  // 点击页面其他地方时隐藏颜色选择器
  document.addEventListener('click', (e) => {
    if (!globals.colorPicker.contains(e.target) && !globals.floatingButton.contains(e.target)) {
      globals.colorPicker.classList.remove('show');
    }
  });

  // ESC 键关闭颜色选择器
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      globals.colorPicker.classList.remove('show');
    }
  });

  updateFloatingButtonState();
}

// 移除已存在的元素
function removeExistingElements() {
  // 移除所有已存在的按钮和颜色选择器
  const existingButtons = document.querySelectorAll('.floating-button');
  const existingPickers = document.querySelectorAll('.highlight-color-picker');
  
  existingButtons.forEach(button => button.remove());
  existingPickers.forEach(picker => picker.remove());
  
  // 移除所有相关的事件监听器
  document.removeEventListener('mousemove', handleButtonDrag);
  document.removeEventListener('mouseup', stopButtonDrag);
  document.removeEventListener('mousedown', handleMouseDown);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
}

function startDragging(e) {
  if (e.target !== globals.floatingButton) return;
  
  globals.isButtonDragging = true;  // 使用新的状态变量
  globals.floatingButton.classList.add('dragging');
  
  // 记录初始位置
  globals.startX = e.clientX;
  globals.startY = e.clientY;
  
  // 获取按钮当前位置
  const rect = globals.floatingButton.getBoundingClientRect();
  globals.initialX = rect.left;
  globals.initialY = rect.top;
  
  // 添加按钮拖动的事件监听器
  document.addEventListener('mousemove', handleButtonDrag);  // 重命名为更具体的函数名
  document.addEventListener('mouseup', stopButtonDrag);      // 重命名为更具体的函数名
  
  e.preventDefault();
  e.stopPropagation();
}

// 重命名为更具体的函数名，专门处理按钮拖动
function handleButtonDrag(e) {
  if (!globals.isButtonDragging || !globals.floatingButton) return;
  
  // 计算新位置
  const deltaX = e.clientX - globals.startX;
  const deltaY = e.clientY - globals.startY;
  
  const newX = globals.initialX + deltaX;
  const newY = globals.initialY + deltaY;
  
  // 确保按钮不会超出视窗
  const buttonWidth = globals.floatingButton.offsetWidth;
  const buttonHeight = globals.floatingButton.offsetHeight;
  
  const maxX = window.innerWidth - buttonWidth;
  const maxY = window.innerHeight - buttonHeight;
  
  const constrainedX = Math.max(0, Math.min(maxX, newX));
  const constrainedY = Math.max(0, Math.min(maxY, newY));
  
  // 更新按钮位置
  globals.floatingButton.style.left = `${constrainedX}px`;
  globals.floatingButton.style.top = `${constrainedY}px`;
  globals.floatingButton.style.right = 'auto';
  
  e.preventDefault();
  e.stopPropagation();
}

// 重命名为更具体的函数名，专门处理按钮拖动结束
function stopButtonDrag(e) {
  if (!globals.isButtonDragging) return;
  
  globals.isButtonDragging = false;
  globals.floatingButton.classList.remove('dragging');
  
  // 保存新位置到 storage
  const rect = globals.floatingButton.getBoundingClientRect();
  chrome.storage.local.set({
    buttonPosition: {
      top: globals.floatingButton.style.top,
      right: window.innerWidth - rect.right + 'px'
    }
  });
  
  // 移除按钮拖动的事件监听器
  document.removeEventListener('mousemove', handleButtonDrag);
  document.removeEventListener('mouseup', stopButtonDrag);
  
  e.preventDefault();
  e.stopPropagation();
}

function updateFloatingButtonState() {
  if (!globals.floatingButton) return;
  
  if (globals.isHighlighting) {
    globals.floatingButton.classList.remove('disabled');
    globals.floatingButton.title = '点击关闭高亮功能，拖动可调整位置';
  } else {
    globals.floatingButton.classList.add('disabled');
    globals.floatingButton.title = '点击开启高亮功能，拖动可调整位置';
  }
}

function toggleHighlighting() {
  globals.isHighlighting = !globals.isHighlighting;
  chrome.storage.local.set({ isHighlighting: globals.isHighlighting }, () => {
    updateFloatingButtonState();
    if (globals.isHighlighting) {
      enableHighlighting();
    } else {
      disableHighlighting();
    }
  });
}

function enableHighlighting() {
  globals.isHighlighting = true;
  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('mouseup', handleMouseUp, true);
  document.body.classList.add('extension-active');
  
  // 添加复制事件支持
  document.addEventListener('copy', handleCopy, true);
  document.addEventListener('cut', handleCopy, true);
  document.addEventListener('paste', handlePaste, true);
}

function disableHighlighting() {
  globals.isHighlighting = false;
  document.removeEventListener('mousedown', handleMouseDown, true);
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('mouseup', handleMouseUp, true);
  document.body.classList.remove('extension-active');
  
  // 移除复制事件支持
  document.removeEventListener('copy', handleCopy, true);
  document.removeEventListener('cut', handleCopy, true);
  document.removeEventListener('paste', handlePaste, true);
}

// 处理复制操作
function handleCopy(e) {
  // 如果正在拖动按钮，不处理复制
  if (globals.isButtonDragging) return;
  
  // 让默认的复制行为继续
  e.stopPropagation();
}

// 处理粘贴操作
function handlePaste(e) {
  // 如果正在拖动按钮，不处理粘贴
  if (globals.isButtonDragging) return;
  
  // 让粘贴操作正常进行
  e.stopPropagation();
}

function handleMouseDown(e) {
  if (!globals.isHighlighting || globals.isButtonDragging) return;  // 添加按钮拖动检查
  
  // 如果点击的是悬浮按钮或颜色选择器，不处理
  if ((globals.floatingButton && globals.floatingButton.contains(e.target)) || 
      (globals.colorPicker && globals.colorPicker.contains(e.target))) {
    return;
  }
  
  // 如果点击的是表单元素，让其正常工作
  if (e.target.matches('input, textarea, select, [contenteditable="true"]')) {
    return;
  }
  
  // 如果点击的不是已高亮的文本，则取消当前的文本选择
  const isHighlightedText = e.target.closest('.extension-highlight');
  if (!isHighlightedText) {
    const selection = window.getSelection();
    selection.removeAllRanges();
  }
  
  // 只响应左键
  if (e.button !== 0) return;

  // 如果是按住 Ctrl 键，不阻止默认行为（允许复制）
  if (e.ctrlKey) return;

  // 如果点击的是链接，并且不是拖动操作，让链接正常工作
  if (e.target.closest('a') && !globals.isDragging) {
    return;
  }
  
  globals.clickStartTime = Date.now();
  globals.isMouseDown = true;
  globals.isDragging = false;
  globals.startPoint = {
    x: e.clientX,
    y: e.clientY,
    target: e.target,
    offset: getTextNodeOffset(e)
  };

  // 只在非 Ctrl 键按下时阻止默认的文本选择
  if (!e.ctrlKey) {
    e.preventDefault();
  }
}

function handleMouseMove(e) {
  if (!globals.isHighlighting || globals.isButtonDragging || !globals.isMouseDown || !globals.startPoint) return;
  
  // 如果是表单元素，让其正常工作
  if (e.target.matches('input, textarea, select, [contenteditable="true"]')) {
    return;
  }
  
  // 如果按住 Ctrl 键，不处理拖动
  if (e.ctrlKey) return;

  // 检测是否开始拖动（移动超过5像素）
  if (!globals.isDragging) {
    const moveDistance = Math.sqrt(
      Math.pow(e.clientX - globals.startPoint.x, 2) + 
      Math.pow(e.clientY - globals.startPoint.y, 2)
    );
    if (moveDistance > 5) {
      globals.isDragging = true;
      document.body.classList.add('dragging');
    }
  }

  if (globals.isDragging) {
    // 只在非 Ctrl 键按下时阻止默认行为
    if (!e.ctrlKey) {
      e.preventDefault();
    }
    const endPoint = {
      x: e.clientX,
      y: e.clientY,
      target: e.target,
      offset: getTextNodeOffset(e)
    };

    highlightBetweenPoints(globals.startPoint, endPoint);
  }
}

function handleMouseUp(e) {
  if (!globals.isHighlighting || globals.isButtonDragging) return;
  
  // 如果是表单元素，让其正常工作
  if (e.target.matches('input, textarea, select, [contenteditable="true"]')) {
    return;
  }
  
  // 如果按住 Ctrl 键，不处理高亮
  if (e.ctrlKey) {
    globals.isMouseDown = false;
    globals.isDragging = false;
    document.body.classList.remove('dragging');
    globals.startPoint = null;
    return;
  }
  
  // 如果是拖动操作，处理高亮
  if (globals.isMouseDown && globals.isDragging) {
    const endPoint = {
      x: e.clientX,
      y: e.clientY,
      target: e.target,
      offset: getTextNodeOffset(e)
    };
    
    highlightBetweenPoints(globals.startPoint, endPoint);
    
    // 只在非 Ctrl 键按下时阻止事件传播
    if (!e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
    }
  } else if (globals.isMouseDown) {
    // 如果是点击操作，检查点击时长
    const clickDuration = Date.now() - globals.clickStartTime;
    if (clickDuration < 200 && e.target.closest('a')) {
      // 是快速点击，让链接正常工作
      return;
    }
  }
  
  globals.isMouseDown = false;
  globals.isDragging = false;
  document.body.classList.remove('dragging');
  globals.startPoint = null;
}

function getTextNodeOffset(e) {
  const range = document.caretRangeFromPoint(e.clientX, e.clientY);
  return range ? {
    node: range.startContainer,
    offset: range.startOffset
  } : null;
}

function highlightBetweenPoints(start, end) {
  try {
    const selection = window.getSelection();
    selection.removeAllRanges();

    const range = document.createRange();
    
    // 如果起点和终点在同一个文本节点内
    if (start.offset && end.offset && start.offset.node === end.offset.node) {
      const startOffset = Math.min(start.offset.offset, end.offset.offset);
      const endOffset = Math.max(start.offset.offset, end.offset.offset);
      
      // 检查偏移量是否有效
      if (startOffset >= 0 && endOffset <= start.offset.node.length) {
        range.setStart(start.offset.node, startOffset);
        range.setEnd(start.offset.node, endOffset);
      } else {
        console.log('无效的文本节点偏移量');
        return;
      }
    } else {
      // 使用元素位置来确定范围
      const startRange = document.caretRangeFromPoint(start.x, start.y);
      const endRange = document.caretRangeFromPoint(end.x, end.y);
      
      if (startRange && endRange) {
        try {
          // 检查范围是否有效
          if (startRange.startContainer && endRange.endContainer) {
            if (startRange.compareBoundaryPoints(Range.START_TO_START, endRange) <= 0) {
              range.setStart(startRange.startContainer, startRange.startOffset);
              range.setEnd(endRange.endContainer, endRange.endOffset);
            } else {
              range.setStart(endRange.startContainer, endRange.startOffset);
              range.setEnd(startRange.endContainer, startRange.endOffset);
            }
          } else {
            console.log('无效的范围容器');
            return;
          }
        } catch (e) {
          console.log('设置范围边界时出错:', e);
          return;
        }
      } else {
        console.log('无法获取有效的范围');
        return;
      }
    }

    // 检查范围是否有效
    if (!range.collapsed && range.startContainer && range.endContainer) {
      try {
        selection.addRange(range);
        highlightSelection();
      } catch (e) {
        console.log('添加范围到选择时出错:', e);
      }
    } else {
      console.log('无效的选择范围');
    }
  } catch (e) {
    console.log('创建选择范围时出错:', e);
  }
}

function highlightSelection() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return;

  try {
    // 保存当前选择
    const savedRange = range.cloneRange();
    
    // 创建高亮span
    const span = document.createElement('span');
    span.className = 'extension-highlight';
    span.style.backgroundColor = globals.currentColor;
    span.style.userSelect = 'text';
    span.style.webkitUserSelect = 'text';
    span.style.mozUserSelect = 'text';
    span.style.msUserSelect = 'text';

    // 尝试直接高亮
    try {
      range.surroundContents(span);
    } catch (e) {
      // 如果surroundContents失败，尝试分段高亮
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }

    // 恢复选择
    selection.removeAllRanges();
    selection.addRange(savedRange);
  } catch (err) {
    console.log('无法高亮选中的文字:', err);
  }
}

function clearHighlights() {
  const highlights = document.querySelectorAll('.extension-highlight');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    while (highlight.firstChild) {
      parent.insertBefore(highlight.firstChild, highlight);
    }
    parent.removeChild(highlight);
  });
}

// 确保在 DOM 加载完成后初始化，并且只初始化一次
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePlugin, { once: true });
} else {
  initializePlugin();
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    initializePlugin();
    sendResponse({ status: 'ok' });
    return true;
  } else if (request.action === 'startHighlighting') {
    initializePlugin();
    globals.isHighlighting = true;
    chrome.storage.local.set({ isHighlighting: true }, () => {
      updateFloatingButtonState();
      enableHighlighting();
    });
  } else if (request.action === 'stopHighlighting') {
    globals.isHighlighting = false;
    chrome.storage.local.set({ isHighlighting: false }, () => {
      updateFloatingButtonState();
      disableHighlighting();
    });
  } else if (request.action === 'updateColor') {
    globals.currentColor = request.color;
    chrome.storage.local.set({ highlightColor: globals.currentColor });
  } else if (request.action === 'clearHighlights') {
    clearHighlights();
  }
  return true;
});

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.isHighlighting) {
      globals.isHighlighting = changes.isHighlighting.newValue;
      updateFloatingButtonState();
    }
    if (changes.highlightColor) {
      globals.currentColor = changes.highlightColor.newValue;
    }
  }
}); 