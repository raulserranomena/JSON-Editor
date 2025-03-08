/*******************************************************
 * GLOBALS
 *******************************************************/
let jsonData = null; // in-memory JSON object
const fileInput = document.getElementById("fileInput");
const jsonContainer = document.getElementById("jsonContainer");
const saveJsonBtn = document.getElementById("saveJsonBtn");

/**
 * When a file is selected, read and parse the JSON,
 * and render it in the container.
 */
fileInput.addEventListener("change", function () {
  if (!fileInput.files || fileInput.files.length === 0) return;
  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      jsonData = JSON.parse(e.target.result);
      // Clear any old DOM
      jsonContainer.innerHTML = "";
      // Build the DOM
      const rootNode = buildJsonNode(jsonData, null, "");
      jsonContainer.appendChild(rootNode);
    } catch (err) {
      alert("Invalid JSON file!");
      console.error(err);
    }
  };

  reader.readAsText(file);
});

/**
 * "Save JSON" button => Export updated data as a file
 */
saveJsonBtn.addEventListener("click", () => {
  if (!jsonData) return;
  const fileName = "updated.json";
  const jsonStr = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

/*******************************************************
 * MAIN RENDERING LOGIC
 *******************************************************/
/**
 * Build a DOM element that represents `data` (object/array/primitive).
 * @param {any} data The current JSON data (object, array, or primitive).
 * @param {object|array|null} parent The parent object or array in the JSON structure.
 * @param {string|number} key The key/index under which `data` is stored in `parent`.
 * @returns {HTMLElement} The DOM element for this node.
 */
function buildJsonNode(data, parent, key) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("json-item", "collapsed"); // default collapsed

  // Create the toggle (+/-) button
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "toggle-button";
  toggleBtn.textContent = "+";
  toggleBtn.style.display = "none"; // will show only if we have children
  wrapper.appendChild(toggleBtn);

  // Create a span for the “header” (key name, etc.)
  const headerSpan = document.createElement("span");
  headerSpan.classList.add("item-header");
  wrapper.appendChild(headerSpan);

  // Key text
  const keySpan = document.createElement("span");
  if (key !== "") {
    keySpan.textContent = `${key}: `;
  }
  headerSpan.appendChild(keySpan);

  // If data is an object or array:
  if (typeof data === "object" && data !== null) {
    // Show "Edit" / "Delete" by default (normal mode)
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    headerSpan.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    headerSpan.appendChild(deleteBtn);

    // Children container
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "json-children";
    wrapper.appendChild(childrenContainer);

    // If it's object or array, we do have children
    toggleBtn.style.display = "inline-block";
    toggleBtn.addEventListener("click", () => {
      const isCollapsed = wrapper.classList.toggle("collapsed");
      toggleBtn.textContent = isCollapsed ? "+" : "-";
    });

    // Build child nodes
    const entries = Array.isArray(data)
      ? data.map((val, idx) => ({ key: idx, value: val }))
      : Object.entries(data).map(([k, v]) => ({ key: k, value: v }));

    // For drag-and-drop reordering, we only support arrays.
    // We'll make each child wrapper draggable if parent is an array.
    if (Array.isArray(data)) {
      childrenContainer.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        // highlight potential drop target
        if (ev.target.classList.contains("json-item")) {
          ev.target.classList.add("drag-over");
        }
      });
      childrenContainer.addEventListener("dragleave", (ev) => {
        if (ev.target.classList.contains("json-item")) {
          ev.target.classList.remove("drag-over");
        }
      });
      childrenContainer.addEventListener("drop", (ev) => {
        ev.preventDefault();
        if (dragSrcNode && dragSrcNode !== ev.target.closest(".json-item")) {
          // Reorder the array
          const fromIndex = parseInt(dragSrcNode.getAttribute("data-index"), 10);
          const toNode = ev.target.closest(".json-item");
          const toIndex = parseInt(toNode.getAttribute("data-index"), 10);

          // remove highlight
          toNode.classList.remove("drag-over");

          if (!Number.isNaN(fromIndex) && !Number.isNaN(toIndex)) {
            // Move data[fromIndex] to index=toIndex
            const movedItem = data.splice(fromIndex, 1)[0];
            data.splice(toIndex, 0, movedItem);
            // Rebuild the children
            rebuildChildren(childrenContainer, data);
          }
        }
      });
    }

    // Populate children
    entries.forEach((childEntry, childIndex) => {
      const childNode = buildJsonNode(childEntry.value, data, childEntry.key);
      if (Array.isArray(data)) {
        // mark so we can reorder
        childNode.setAttribute("draggable", "true");
        childNode.setAttribute("data-index", childEntry.key);

        // Drag events
        childNode.addEventListener("dragstart", (ev) => {
          dragSrcNode = childNode;
        });
        childNode.addEventListener("dragend", () => {
          dragSrcNode = null;
        });
      }
      childrenContainer.appendChild(childNode);
    });

    /*********************************
     * Normal-mode Buttons (Edit, Delete)
     *********************************/
    editBtn.addEventListener("click", () => {
      // Expand
      wrapper.classList.remove("collapsed");
      toggleBtn.textContent = "-";

      // Hide the normal edit/delete
      editBtn.style.display = "none";
      deleteBtn.style.display = "none";

      // Show “Cancel”, “Save”, “Edit text”, “Add child”
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      headerSpan.appendChild(cancelBtn);

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Save";
      headerSpan.appendChild(saveBtn);

      const editTextBtn = document.createElement("button");
      editTextBtn.textContent = "Edit text";
      headerSpan.appendChild(editTextBtn);

      const addChildBtn = document.createElement("button");
      addChildBtn.textContent = "Add child";
      headerSpan.appendChild(addChildBtn);

      // "Edit text" => rename this key
      // (Note: If this is the root node, key is "")
      editTextBtn.addEventListener("click", () => {
        if (!parent || key === "") {
          // Root or no parent => skip
          alert("Cannot rename root node.");
          return;
        }
        // Hide the new 4 buttons
        cancelBtn.style.display = "none";
        saveBtn.style.display = "none";
        editTextBtn.style.display = "none";
        addChildBtn.style.display = "none";

        // Put an input for editing the key
        const oldKey = String(key);
        const textInput = document.createElement("input");
        textInput.type = "text";
        textInput.value = oldKey;
        // auto-size to content
        textInput.size = textInput.value.length + 1;

        headerSpan.insertBefore(textInput, keySpan);
        keySpan.style.display = "none";

        const tmpCancel = document.createElement("button");
        tmpCancel.textContent = "Cancel";
        headerSpan.appendChild(tmpCancel);

        const tmpSave = document.createElement("button");
        tmpSave.textContent = "Save";
        headerSpan.appendChild(tmpSave);

        tmpCancel.addEventListener("click", () => {
          // revert
          textInput.remove();
          tmpCancel.remove();
          tmpSave.remove();
          keySpan.style.display = "inline";
          // restore the original 4
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editTextBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });

        tmpSave.addEventListener("click", () => {
          const newKey = textInput.value;
          if (newKey !== oldKey && newKey !== "") {
            // rename the key inside the parent
            if (Array.isArray(parent)) {
              // parent is array => not typical to rename an index
              alert("Cannot rename an array index.");
            } else {
              // rename in object
              parent[newKey] = data;
              delete parent[oldKey];
              key = newKey; // update local key
            }
          }
          keySpan.textContent = newKey + ": ";
          // remove UI
          textInput.remove();
          tmpCancel.remove();
          tmpSave.remove();
          keySpan.style.display = "inline";
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editTextBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });
      });

      // "Add child"
      addChildBtn.addEventListener("click", () => {
        if (Array.isArray(data)) {
          // add to array at top
          data.unshift({ "new child": "" });
        } else {
          // add property at top (simulate by creating new object, then merging old)
          const newObj = { "new child": "" };
          for (const [k, v] of Object.entries(data)) {
            newObj[k] = v;
          }
          // replace data
          if (Array.isArray(parent)) {
            // find index
            const idx = parent.indexOf(data);
            if (idx >= 0) {
              parent[idx] = newObj;
            }
          } else if (parent) {
            parent[key] = newObj;
          } else {
            // root
            jsonData = newObj;
          }
          data = newObj;
        }
        // Rebuild children (but do not collapse)
        rebuildChildren(childrenContainer, data);
      });

      // "Cancel" => revert UI only
      cancelBtn.addEventListener("click", () => {
        // Hide the 4 new buttons
        cancelBtn.remove();
        saveBtn.remove();
        editTextBtn.remove();
        addChildBtn.remove();
        // Show normal edit/delete again
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });

      // "Save" => accept changes in the data structure, keep expanded
      saveBtn.addEventListener("click", () => {
        // Hide the 4 new
        cancelBtn.remove();
        saveBtn.remove();
        editTextBtn.remove();
        addChildBtn.remove();
        // Show normal edit/delete again, remain expanded
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });
    });

    // "Delete" => remove this node from its parent
    deleteBtn.addEventListener("click", () => {
      if (parent !== null) {
        if (Array.isArray(parent)) {
          const index = parent.indexOf(data);
          if (index >= 0) {
            parent.splice(index, 1);
          }
        } else {
          // remove key from object
          delete parent[key];
        }
      } else {
        // top-level
        jsonData = {};
      }
      wrapper.remove();
    });
  } else {
    /*********************************************
     * PRIMITIVE DATA (string, number, boolean, null)
     *********************************************/
    const valueSpan = document.createElement("span");
    valueSpan.textContent = data;
    headerSpan.appendChild(valueSpan);

    // No child container needed
    toggleBtn.style.display = "none";

    // "Edit" / "Delete"
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    headerSpan.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    headerSpan.appendChild(deleteBtn);

    editBtn.addEventListener("click", () => {
      // Hide normal buttons
      editBtn.style.display = "none";
      deleteBtn.style.display = "none";

      // "Cancel", "Save", "Edit text", "Add child"
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      headerSpan.appendChild(cancelBtn);

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Save";
      headerSpan.appendChild(saveBtn);

      const editTextBtn = document.createElement("button");
      editTextBtn.textContent = "Edit text";
      headerSpan.appendChild(editTextBtn);

      const addChildBtn = document.createElement("button");
      addChildBtn.textContent = "Add child";
      headerSpan.appendChild(addChildBtn);

      // "Edit text" => let user change the value
      editTextBtn.addEventListener("click", () => {
        // Hide the 4
        cancelBtn.style.display = "none";
        saveBtn.style.display = "none";
        editTextBtn.style.display = "none";
        addChildBtn.style.display = "none";

        // Create input
        const textInput = document.createElement("input");
        textInput.type = "text";
        textInput.value = data;
        // auto-size
        textInput.size = textInput.value.length + 1;

        headerSpan.insertBefore(textInput, valueSpan);
        valueSpan.style.display = "none";

        const tmpCancel = document.createElement("button");
        tmpCancel.textContent = "Cancel";
        headerSpan.appendChild(tmpCancel);

        const tmpSave = document.createElement("button");
        tmpSave.textContent = "Save";
        headerSpan.appendChild(tmpSave);

        tmpCancel.addEventListener("click", () => {
          textInput.remove();
          tmpCancel.remove();
          tmpSave.remove();
          valueSpan.style.display = "inline";
          // restore original 4
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editTextBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });

        tmpSave.addEventListener("click", () => {
          const newVal = textInput.value;
          // Update data in the parent
          if (parent !== null) {
            if (Array.isArray(parent)) {
              const idx = parent.indexOf(data);
              if (idx >= 0) {
                parent[idx] = newVal;
              }
            } else {
              parent[key] = newVal;
            }
            data = newVal; // local update
          } else {
            // top-level primitive
            jsonData = newVal;
            data = newVal;
          }
          valueSpan.textContent = newVal;
          textInput.remove();
          tmpCancel.remove();
          tmpSave.remove();
          valueSpan.style.display = "inline";
          // restore original 4
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editTextBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });
      });

      // "Add child" => transform this primitive into an object with "old value"
      addChildBtn.addEventListener("click", () => {
        const oldVal = data;
        const newObj = {
          "new child": "",
          "old value": oldVal,
        };
        if (parent) {
          if (Array.isArray(parent)) {
            const idx = parent.indexOf(data);
            if (idx >= 0) {
              parent[idx] = newObj;
            }
          } else {
            parent[key] = newObj;
          }
        } else {
          jsonData = newObj;
        }

        // Rebuild the node in place:
        const newNode = buildJsonNode(newObj, parent, key);
        wrapper.replaceWith(newNode);
      });

      // "Cancel"
      cancelBtn.addEventListener("click", () => {
        cancelBtn.remove();
        saveBtn.remove();
        editTextBtn.remove();
        addChildBtn.remove();
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });

      // "Save"
      saveBtn.addEventListener("click", () => {
        cancelBtn.remove();
        saveBtn.remove();
        editTextBtn.remove();
        addChildBtn.remove();
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });
    });

    deleteBtn.addEventListener("click", () => {
      if (parent !== null) {
        if (Array.isArray(parent)) {
          const idx = parent.indexOf(data);
          if (idx >= 0) {
            parent.splice(idx, 1);
          }
        } else {
          delete parent[key];
        }
      } else {
        // was root
        jsonData = {};
      }
      wrapper.remove();
    });
  }

  return wrapper;
}

/*******************************************************
 * HELPER: Rebuild children inside an existing container
 *         (keeping the parent data the same).
 *******************************************************/
function rebuildChildren(container, parentData) {
  // Clear container
  container.innerHTML = "";

  // Build entries
  const entries = Array.isArray(parentData)
    ? parentData.map((val, idx) => ({ key: idx, value: val }))
    : Object.entries(parentData).map(([k, v]) => ({ key: k, value: v }));

  entries.forEach((childEntry) => {
    const childNode = buildJsonNode(childEntry.value, parentData, childEntry.key);
    if (Array.isArray(parentData)) {
      childNode.setAttribute("draggable", "true");
      childNode.setAttribute("data-index", childEntry.key);

      childNode.addEventListener("dragstart", (ev) => {
        dragSrcNode = childNode;
      });
      childNode.addEventListener("dragend", () => {
        dragSrcNode = null;
      });
    }
    container.appendChild(childNode);
  });
}

/*******************************************************
 * DRAG & DROP SUPPORT
 *******************************************************/
let dragSrcNode = null;
