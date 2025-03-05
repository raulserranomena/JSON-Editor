let jsonData = {};
let currentEditModeItem = null;

document.getElementById('jsonFileInput').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      jsonData = JSON.parse(e.target.result);
      displayJSON(jsonData, document.getElementById('jsonContainer'));
    };
    reader.readAsText(file);
  }
});

document.getElementById('saveButton').addEventListener('click', function() {
  const jsonStr = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'updated.json';
  a.click();
  URL.revokeObjectURL(url);
});

function displayJSON(data, container) {
  container.innerHTML = '';
  const list = createList(data);
  container.appendChild(list);
}

function createList(data, parentKey = null) {
  const ul = document.createElement('ul');
  for (const key in data) {
    const li = document.createElement('li');
    li.classList.add('list-item', 'draggable');
    li.setAttribute('data-key', key);
    li.setAttribute('data-parent', parentKey);

    const collapsible = document.createElement('div');
    collapsible.classList.add('collapsible');
    collapsible.textContent = key;
    collapsible.addEventListener('click', function(event) {
      if (!event.target.classList.contains('button')) {
        const content = this.nextElementSibling;
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
      }
    });

    const editTextButton = document.createElement('button');
    editTextButton.textContent = 'Edit Text';
    editTextButton.classList.add('button');
    editTextButton.addEventListener('click', function() {
      enableEditTextMode(collapsible, key, data);
    });

    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.classList.add('button');
    editButton.addEventListener('click', function() {
      if (currentEditModeItem) {
        disableEditMode(currentEditModeItem);
      }
      enableEditMode(li, data[key]);
      currentEditModeItem = li;
    });

    const addButton = document.createElement('button');
    addButton.textContent = 'Add Attribute';
    addButton.classList.add('button', 'add');
    addButton.addEventListener('click', function() {
      const newKey = prompt('Enter new attribute name:');
      if (newKey) {
        data[newKey] = "";
        displayJSON(jsonData, document.getElementById('jsonContainer'));
      }
    });

    collapsible.appendChild(editTextButton);
    collapsible.appendChild(editButton);
    collapsible.appendChild(addButton);
    li.appendChild(collapsible);

    const content = document.createElement('div');
    content.classList.add('content');
    if (typeof data[key] === 'object' && !Array.isArray(data[key])) {
      content.appendChild(createList(data[key], key));
    } else {
      content.textContent = JSON.stringify(data[key]);
    }
    li.appendChild(content);
    ul.appendChild(li);
  }
  return ul;
}

function enableEditTextMode(element, key, data) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = key;
  element.innerHTML = '';
  element.appendChild(input);

  input.addEventListener('blur', function() {
    const newKey = input.value.trim();
    if (newKey && newKey !== key) {
      data[newKey] = data[key];
      delete data[key];
      displayJSON(jsonData, document.getElementById('jsonContainer'));
    }
  });

  input.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      input.blur();
    }
  });

  input.focus();
}

function enableEditMode(li, data) {
  const content = li.querySelector('.content');
  content.style.display = 'block'; // Ensure the content is expanded

  const children = content.children;
  for (const child of children) {
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.classList.add('button', 'delete');
    deleteButton.addEventListener('click', function() {
      const key = child.getAttribute('data-key');
      const parentKey = child.getAttribute('data-parent');
      delete jsonData[parentKey][key];
      displayJSON(jsonData, document.getElementById('jsonContainer'));
    });

    if (typeof data === 'object' && !Array.isArray(data)) {
      child.querySelector('.collapsible').appendChild(deleteButton);
    } else {
      const editValueButton = document.createElement('button');
      editValueButton.textContent = 'Edit Value';
      editValueButton.classList.add('button');
      editValueButton.addEventListener('click', function() {
        const newValue = prompt('Enter new value:', data);
        if (newValue !== null) {
          const parentKey = child.getAttribute('data-parent');
          jsonData[parentKey][child.getAttribute('data-key')] = newValue;
          displayJSON(jsonData, document.getElementById('jsonContainer'));
        }
      });
      child.querySelector('.collapsible').appendChild(editValueButton);
    }
  }
}

function disableEditMode(li) {
  const content = li.querySelector('.content');
  const children = content.children;
  for (const child of children) {
    const collapsible = child.querySelector('.collapsible');
    if (collapsible) {
      collapsible.querySelectorAll('.button.delete, .button.edit').forEach(button => button.remove());
    }
  }
}

// Drag and Drop Functionality
let dragSrcEl = null;

function handleDragStart(e) {
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter(e) {
  this.classList.add('over');
}

function handleDragLeave(e) {
  this.classList.remove('over');
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  if (dragSrcEl !== this) {
    dragSrcEl.innerHTML = this.innerHTML;
    this.innerHTML = e.dataTransfer.getData('text/html');
  }
  return false;
}

function handleDragEnd(e) {
  this.classList.remove('over');
}

const draggables = document.querySelectorAll('.draggable');
draggables.forEach(draggable => {
  draggable.addEventListener('dragstart', handleDragStart);
  draggable.addEventListener('dragover', handleDragOver);
  draggable.addEventListener('dragenter', handleDragEnter);
  draggable.addEventListener('dragleave', handleDragLeave);
  draggable.addEventListener('drop', handleDrop);
  draggable.addEventListener('dragend', handleDragEnd);
});
