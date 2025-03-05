let jsonData = {};
let currentEditModeItem = null;
let originalDataCopy = null;

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

    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.classList.add('button');
    editButton.addEventListener('click', function() {
      if (currentEditModeItem) {
        disableEditMode(currentEditModeItem);
      }
      enableEditMode(li, data[key], data);
      currentEditModeItem = li;
    });

    collapsible.appendChild(editButton);
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

function enableEditMode(li, data, parentData) {
  const collapsible = li.querySelector('.collapsible');
  const content = li.querySelector('.content');
  content.style.display = 'block'; // Ensure the content is expanded

  // Hide the "Edit" button
  collapsible.querySelector('button').style.display = 'none';

  // Create and add new buttons
  const cancelEditsButton = createButton('Cancel Edits', 'button', () => cancelEdits(li, parentData));
  const saveEditsButton = createButton('Save Edits', 'button', () => saveEdits(li, parentData));
  const updateTextButton = createButton('Update Text', 'button', () => enableUpdateTextMode(collapsible, data, parentData));
  const addAttributeButton = createButton('Add Attribute', 'button add', () => addAttribute(data));
  const deleteButton = createButton('Delete', 'button delete', () => deleteItem(li, parentData));

  collapsible.appendChild(cancelEditsButton);
  collapsible.appendChild(saveEditsButton);
  collapsible.appendChild(updateTextButton);
  collapsible.appendChild(addAttributeButton);
  collapsible.appendChild(deleteButton);

  // Enable drag and drop for child items
  enableDragAndDrop(content);

  // Make a copy of the original data for canceling edits
  originalDataCopy = JSON.parse(JSON.stringify(parentData));
}

function disableEditMode(li) {
  const collapsible = li.querySelector('.collapsible');
  const content = li.querySelector('.content');

  // Remove all buttons except the "Edit" button
  collapsible.innerHTML = '';
  const editButton = createButton('Edit', 'button', () => enableEditMode(li, jsonData[collapsible.textContent], jsonData));
  collapsible.appendChild(editButton);

  // Hide the content if it was expanded
  content.style.display = 'none';

  // Reset the current edit mode item
  currentEditModeItem = null;
}

function enableUpdateTextMode(collapsible, data, parentData) {
  const key = collapsible.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = key;

  // Replace the collapsible content with the input field
  collapsible.innerHTML = '';
  collapsible.appendChild(input);

  // Add "Cancel" and "Save Text" buttons
  const cancelButton = createButton('Cancel', 'button', () => cancelUpdateText(collapsible, key));
  const saveTextButton = createButton('Save Text', 'button', () => saveText(collapsible, input.value, data, parentData));

  collapsible.appendChild(cancelButton);
  collapsible.appendChild(saveTextButton);

  input.focus();
}

function cancelUpdateText(collapsible, originalKey) {
  collapsible.textContent = originalKey;
  enableEditMode(collapsible.parentElement, jsonData[originalKey], jsonData);
}

function saveText(collapsible, newKey, data, parentData) {
  if (newKey && newKey !== collapsible.textContent) {
    parentData[newKey] = data;
    delete parentData[collapsible.textContent];
    displayJSON(jsonData, document.getElementById('jsonContainer'));
  }
}

function addAttribute(data) {
  const newKey = prompt('Enter new attribute name:');
  if (newKey) {
    data[newKey] = "";
    displayJSON(jsonData, document.getElementById('jsonContainer'));
  }
}

function deleteItem(li, parentData) {
  const key = li.getAttribute('data-key');
  delete parentData[key];
  displayJSON(jsonData, document.getElementById('jsonContainer'));
}

function cancelEdits(li, parentData) {
  Object.assign(parentData, originalDataCopy);
  displayJSON(jsonData, document.getElementById('jsonContainer'));
}

function saveEdits(li, parentData) {
  originalDataCopy = null;
  disableEditMode(li);
}

function createButton(text, className, onClick) {
  const button = document.createElement('button');
  button.textContent = text;
  button.classList.add(...className.split(' '));
  button.addEventListener('click', onClick);
  return button;
}

function enableDragAndDrop(container) {
  const draggables = container.querySelectorAll('.draggable');
  draggables.forEach(draggable => {
    draggable.setAttribute('draggable', true);
    draggable.addEventListener('dragstart', handleDragStart);
    draggable.addEventListener('dragover', handleDragOver);
    draggable.addEventListener('drop', handleDrop);
  });
}

function handleDragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.getAttribute('data-key'));
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDrop(e) {
  e.preventDefault();
  const draggedKey = e.dataTransfer.getData('text/plain');
  const targetKey = e.target.getAttribute('data-key');
  const parentData = jsonData[e.target.getAttribute('data-parent')];

  if (draggedKey && targetKey && draggedKey !== targetKey) {
    const keys = Object.keys(parentData);
    const draggedIndex = keys.indexOf(draggedKey);
    const targetIndex = keys.indexOf(targetKey);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const temp = keys[draggedIndex];
      keys[draggedIndex] = keys[targetIndex];
      keys[targetIndex] = temp;

      const reorderedData = {};
      keys.forEach(key => {
        reorderedData[key] = parentData[key];
      });

      Object.assign(parentData, reorderedData);
      displayJSON(jsonData, document.getElementById('jsonContainer'));
    }
  }
}
