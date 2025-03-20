let isHighlighting = false;
let currentColor = '#ffeb3b';
let isMouseDown = false;
let startPoint = null;
let isDragging = false;
let clickStartTime = 0;
let floatingButton = null;
let colorPicker = null;

// 初始化插件
function initializePlugin() {
  // 创建悬浮按钮
  createFloatingButton();
  
  // 从存储中恢复状态
  chrome.storage.local.get(['isHighlighting', 'highlightColor'], (result) => {
    if (result.highlightColor) {
      currentColor = result.highlightColor;
      if (colorPicker) {
        colorPicker.querySelector('input').value = currentColor;
      }
    }
    
    if (result.isHighlighting) {
      toggleHighlighting(true);
    }
  });
}

// 创建悬浮按钮和颜色选择器
function createFloatingButton() {
  // 创建颜色选择器容器
  colorPicker = document.createElement('div');
  colorPicker.className = 'highlight-color-picker';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = currentColor;
  colorInput.addEventListener('change', (e) => {
    currentColor = e.target.value;
    chrome.storage.local.set({ highlightColor: currentColor });
  });
  colorPicker.appendChild(colorInput);
  document.body.appendChild(colorPicker);

  // 创建悬浮按钮
  floatingButton = document.createElement('button');
  floatingButton.className = 'highlight-floating-button';
  floatingButton.innerHTML = '✍';
  floatingButton.title = '点击开启/关闭高亮功能，右键点击显示颜色选择器';
  
  // 左键点击切换高亮状态
  floatingButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleHighlighting(!isHighlighting);
  });
  
  // 右键点击显示颜色选择器
  floatingButton.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    colorPicker.classList.toggle('show');
  });
  
  // 点击页面其他地方时隐藏颜色选择器
  document.addEventListener('click', (e) => {
    if (!colorPicker.contains(e.target) && !floatingButton.contains(e.target)) {
      colorPicker.classList.remove('show');
    }
  });

  document.body.appendChild(floatingButton);
}

// 切换高亮状态
function toggleHighlighting(enable) {
  isHighlighting = enable;
  if (isHighlighting) {
    document.body.classList.add('extension-active');
    floatingButton.classList.add('active');
    enableHighlighting();
  } else {
    document.body.classList.remove('extension-active');
    document.body.classList.remove('dragging');
    floatingButton.classList.remove('active');
    disableHighlighting();
  }
  
  // 保存状态
  chrome.storage.local.set({ isHighlighting: isHighlighting });
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startHighlighting') {
    toggleHighlighting(true);
  } else if (request.action === 'stopHighlighting') {
    toggleHighlighting(false);
  } else if (request.action === 'updateColor') {
    currentColor = request.color;
    if (colorPicker) {
      colorPicker.querySelector('input').value = currentColor;
    }
  } else if (request.action === 'clearHighlights') {
    clearHighlights();
  }
});

function enableHighlighting() {
  document.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('mouseup', handleMouseUp, true);
}

function disableHighlighting() {
  document.removeEventListener('mousedown', handleMouseDown, true);
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('mouseup', handleMouseUp, true);
}

function handleMouseDown(e) {
  if (!isHighlighting) return;
  
  // 如果点击的是悬浮按钮或颜色选择器，不处理
  if (floatingButton.contains(e.target) || colorPicker.contains(e.target)) {
    return;
  }
  
  // 只响应左键
  if (e.button !== 0) return;

  // 如果点击的是链接，并且不是拖动操作，让链接正常工作
  if (e.target.closest('a') && !isDragging) {
    return;
  }
  
  clickStartTime = Date.now();
  isMouseDown = true;
  isDragging = false;
  startPoint = {
    x: e.clientX,
    y: e.clientY,
    target: e.target,
    offset: getTextNodeOffset(e)
  };

  // 阻止默认的文本选择
  e.preventDefault();
}

function handleMouseMove(e) {
  if (!isHighlighting || !isMouseDown || !startPoint) return;

  // 检测是否开始拖动（移动超过5像素）
  if (!isDragging) {
    const moveDistance = Math.sqrt(
      Math.pow(e.clientX - startPoint.x, 2) + 
      Math.pow(e.clientY - startPoint.y, 2)
    );
    if (moveDistance > 5) {
      isDragging = true;
      document.body.classList.add('dragging');
    }
  }

  if (isDragging) {
    e.preventDefault(); // 防止文本选择的默认行为
    const endPoint = {
      x: e.clientX,
      y: e.clientY,
      target: e.target,
      offset: getTextNodeOffset(e)
    };

    highlightBetweenPoints(startPoint, endPoint);
  }
}

function handleMouseUp(e) {
  if (!isHighlighting) return;
  
  // 如果是拖动操作，处理高亮
  if (isMouseDown && isDragging) {
    const endPoint = {
      x: e.clientX,
      y: e.clientY,
      target: e.target,
      offset: getTextNodeOffset(e)
    };
    
    highlightBetweenPoints(startPoint, endPoint);
    e.preventDefault();
    e.stopPropagation();
  } else if (isMouseDown) {
    // 如果是点击操作，检查点击时长
    const clickDuration = Date.now() - clickStartTime;
    if (clickDuration < 200 && e.target.closest('a')) {
      // 是快速点击，让链接正常工作
      return;
    }
  }
  
  isMouseDown = false;
  isDragging = false;
  document.body.classList.remove('dragging');
  startPoint = null;
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
      range.setStart(start.offset.node, startOffset);
      range.setEnd(start.offset.node, endOffset);
    } else {
      // 使用元素位置来确定范围
      const startRange = document.caretRangeFromPoint(start.x, start.y);
      const endRange = document.caretRangeFromPoint(end.x, end.y);
      
      if (startRange && endRange) {
        if (startRange.compareBoundaryPoints(Range.START_TO_START, endRange) <= 0) {
          range.setStart(startRange.startContainer, startRange.startOffset);
          range.setEnd(endRange.endContainer, endRange.endOffset);
        } else {
          range.setStart(endRange.startContainer, endRange.startOffset);
          range.setEnd(startRange.endContainer, startRange.endOffset);
        }
      }
    }

    if (!range.collapsed) {
      selection.addRange(range);
      highlightSelection();
    }
  } catch (e) {
    console.log('无法创建选择范围:', e);
  }
}

function highlightSelection() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return;

  try {
    const span = document.createElement('span');
    span.className = 'extension-highlight';
    span.style.backgroundColor = currentColor;
    span.style.pointerEvents = 'none'; // 确保高亮不会影响底层元素的交互

    // 尝试直接高亮
    range.surroundContents(span);
  } catch (e) {
    // 如果surroundContents失败，尝试分段高亮
    try {
      const contents = range.extractContents();
      const span = document.createElement('span');
      span.className = 'extension-highlight';
      span.style.backgroundColor = currentColor;
      span.style.pointerEvents = 'none'; // 确保高亮不会影响底层元素的交互
      span.appendChild(contents);
      range.insertNode(span);
    } catch (err) {
      console.log('无法高亮选中的文字:', err);
    }
  }

  // 清除选择
  selection.removeAllRanges();
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

// 初始化插件
initializePlugin(); 