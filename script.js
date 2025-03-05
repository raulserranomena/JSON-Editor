document.getElementById('jsonFileInput').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const json = JSON.parse(e.target.result);
      displayJSON(json, document.getElementById('jsonContainer'));
    };
    reader.readAsText(file);
  }
});

function displayJSON(data, container) {
  container.innerHTML = '';
  const list = createList(data);
  container.appendChild(list);
}

function createList(data) {
  const ul = document.createElement('ul');
  for (const key in data) {
    const li = document.createElement('li');
    li.classList.add('list-item');

    const collapsible = document.createElement('div');
    collapsible.classList.add('collapsible');
    collapsible.textContent = key;
    collapsible.addEventListener('click', function() {
      const content = this.nextElementSibling;
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });

    const content = document.createElement('div');
    content.classList.add('content');

    if (typeof data[key] === 'object' && !Array.isArray(data[key])) {
      content.appendChild(createList(data[key]));
    } else {
      content.textContent = JSON.stringify(data[key]);
    }

    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.classList.add('button');
    editButton.addEventListener('click', function() {
      editItem(data, key, content);
    });

    const addButton = document.createElement('button');
    addButton.textContent = 'Add Attribute';
    addButton.classList.add('button', 'add');
    addButton.addEventListener('click', function() {
      addAttribute(data, key, content);
    });

    collapsible.appendChild(editButton);
    collapsible.appendChild(addButton);
    li.appendChild(collapsible);
    li.appendChild(content);
    ul.appendChild(li);
  }
  return ul;
}

function editItem(data, key, content) {
  const newValue = prompt(`Edit ${key}:`, JSON.stringify(data[key]));
  if (newValue !== null) {
    try {
      data[key] = JSON.parse(newValue);
      content.innerHTML = '';
      if (typeof data[key] === 'object' && !Array.isArray(data[key])) {
        content.appendChild(createList(data[key]));
      } else {
        content.textContent = JSON.stringify(data[key]);
      }
    } catch (e) {
      alert('Invalid JSON input');
    }
  }
}

function addAttribute(data, key, content) {
  const newKey = prompt('Enter new attribute name:');
  if (newKey && !data[newKey]) {
    const newValue = prompt(`Enter value for ${newKey}:`);
    if (newValue !== null) {
      try {
        data[newKey] = JSON.parse(newValue);
        content.innerHTML = '';
        content.appendChild(createList(data));
      } catch (e) {
        alert('Invalid JSON input');
      }
    }
  } else {
    alert('Attribute name already exists or is invalid');
  }
}

function deleteAttribute(data, key, content) {
  delete data[key];
  content.innerHTML = '';
  content.appendChild(createList(data));
}
