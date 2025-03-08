/****************************************************************
 * GLOBALS
 ****************************************************************/
let jsonData = null; // The in-memory JSON object
const fileInput = document.getElementById("fileInput");
const jsonContainer = document.getElementById("jsonContainer");
const saveJsonBtn = document.getElementById("saveJsonBtn");
const collapseAllBtn = document.getElementById("collapseAllBtn");

/****************************************************************
 * FILE LOAD / SAVE
 ****************************************************************/
fileInput.addEventListener("change", () => {
  if (!fileInput.files || fileInput.files.length === 0) return;
  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      jsonData = JSON.parse(e.target.result);

      // Clear the container and render everything collapsed
      jsonContainer.innerHTML = "";
      const rootNode = createJsonNode(jsonData, null, "", true /*startCollapsed*/);
      jsonContainer.appendChild(rootNode);
    } catch (err) {
      alert("Invalid JSON file!");
      console.error(err);
    }
  };

  reader.readAsText(file);
});

/**
 * Export the updated JSON as "updated.json"
 */
saveJsonBtn.addEventListener("click", () => {
  if (!jsonData) return;
  const jsonStr = JSON.stringify(jsonData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "updated.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

/**
 * Collapse all nodes in the tree
 */
collapseAllBtn.addEventListener("click", () => {
  // Find all .json-item elements
  const allItems = document.querySelectorAll(".json-item");
  allItems.forEach((item) => {
    item.classList.add("collapsed");
    const toggleBtn = item.querySelector(".toggle-button");
    if (toggleBtn) {
      toggleBtn.textContent = "+";
    }
  });
});

/****************************************************************
 * CREATE JSON NODE (The main function for building the tree)
 ****************************************************************/

/**
 * Build a DOM element representing a single JSON node (object, array, or primitive).
 * @param {any} data The current subtree in the JSON structure
 * @param {object|array|null} parent The parent object/array in the JSON
 * @param {string|number} key The key/index of this data in its parent
 * @param {boolean} startCollapsed Whether this node should initially be collapsed
 */
function createJsonNode(data, parent, key, startCollapsed = false) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("json-item");
  if (startCollapsed) {
    wrapper.classList.add("collapsed");
  }

  /****************************************************
   * Expand/Collapse Button (+/-)
   ****************************************************/
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "toggle-button";
  toggleBtn.textContent = "+";
  toggleBtn.style.display = "none"; // only display if node has children
  wrapper.appendChild(toggleBtn);

  toggleBtn.addEventListener("click", () => {
    const isCollapsed = wrapper.classList.toggle("collapsed");
    toggleBtn.textContent = isCollapsed ? "+" : "-";
  });

  /****************************************************
   * Header (Key label, plus normal-mode buttons)
   ****************************************************/
  const headerSpan = document.createElement("span");
  headerSpan.classList.add("item-header");
  wrapper.appendChild(headerSpan);

  // Show key if not root
  const keySpan = document.createElement("span");
  if (key !== "") {
    keySpan.textContent = `${key}: `;
  }
  headerSpan.appendChild(keySpan);

  /****************************************************
   * If data is object or array => children
   ****************************************************/
  if (typeof data === "object" && data !== null) {
    // Normal mode: "Edit" / "Delete"
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    headerSpan.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    headerSpan.appendChild(deleteBtn);

    // Child container
    const childContainer = document.createElement("div");
    childContainer.classList.add("json-children");
    wrapper.appendChild(childContainer);

    // Build an array of entries so we can order them
    const entries = buildEntriesArray(data);

    if (entries.length > 0) {
      // show the toggle button since we have children
      toggleBtn.style.display = "inline-block";
      if (!startCollapsed) {
        toggleBtn.textContent = "-";
      }
    }

    // Render each child
    entries.forEach((childEntry, index) => {
      const childNode = createJsonNode(childEntry.value, data, childEntry.key, true);
      childNode.setAttribute("data-child-index", index);
      childContainer.appendChild(childNode);
    });

    /*********************************
     * Edit button => "Cancel", "Save", "Edit Key", "Add Child"
     *********************************/
    editBtn.addEventListener("click", () => {
      // Expand
      wrapper.classList.remove("collapsed");
      toggleBtn.textContent = "-";

      // Hide normal mode
      editBtn.style.display = "none";
      deleteBtn.style.display = "none";

      // Insert the new buttons
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      headerSpan.appendChild(cancelBtn);

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Save";
      headerSpan.appendChild(saveBtn);

      const editKeyBtn = document.createElement("button");
      editKeyBtn.textContent = "Edit Key";
      headerSpan.appendChild(editKeyBtn);

      const addChildBtn = document.createElement("button");
      addChildBtn.textContent = "Add Child";
      headerSpan.appendChild(addChildBtn);

      if (!parent || key === "") {
        editKeyBtn.style.display = "none"; // root => no "edit key"
      }

      // We'll store a snapshot of the original order so "Cancel" can revert
      // We'll keep an array of { key, value, domNode } for each child
      const originalEntries = buildEntriesArray(data).map((e, i) => {
        return { key: e.key, value: e.value, domNode: childContainer.children[i] };
      });

      // We'll build a separate array (childOrder) to track the new order
      // as user repositions items. We'll store the same {key, value, domNode} references.
      // That way we reorder in the DOM, but we only finalize changes on Save.
      const childOrder = originalEntries.slice(); // shallow copy

      // Show position controls
      childOrder.forEach((item, i) => {
        // Add the position controls in the child's header
        const node = item.domNode;
        const h = node.querySelector(".item-header");
        if (!h) return;

        // Create a position <input type="number">
        const posInput = document.createElement("input");
        posInput.type = "number";
        posInput.className = "position-input";
        posInput.value = String(i + 1); // 1-based
        posInput.min = "1";
        posInput.max = String(childOrder.length);

        // On Enter, reorder
        posInput.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            let newPos = parseInt(posInput.value, 10);
            if (Number.isNaN(newPos)) return;
            if (newPos < 1 || newPos > childOrder.length) return;
            const oldIndex = childOrder.indexOf(item);
            const newIndex = newPos - 1;
            if (newIndex !== oldIndex) {
              moveItem(childOrder, oldIndex, newIndex);
              reorderDOM(childOrder, childContainer);
            }
          }
        });

        // Up button
        const upBtn = document.createElement("button");
        upBtn.className = "pos-up-btn";
        upBtn.textContent = "▲";
        upBtn.addEventListener("click", () => {
          const oldIndex = childOrder.indexOf(item);
          if (oldIndex > 0) {
            moveItem(childOrder, oldIndex, oldIndex - 1);
            reorderDOM(childOrder, childContainer);
          }
        });

        // Down button
        const downBtn = document.createElement("button");
        downBtn.className = "pos-down-btn";
        downBtn.textContent = "▼";
        downBtn.addEventListener("click", () => {
          const oldIndex = childOrder.indexOf(item);
          if (oldIndex < childOrder.length - 1) {
            moveItem(childOrder, oldIndex, oldIndex + 1);
            reorderDOM(childOrder, childContainer);
          }
        });

        // Insert them at the front
        h.insertBefore(downBtn, h.firstChild);
        h.insertBefore(upBtn, h.firstChild);
        h.insertBefore(posInput, h.firstChild);
      });

      // Cancel => revert
      cancelBtn.addEventListener("click", () => {
        // Restore original DOM order
        while (childContainer.firstChild) {
          childContainer.removeChild(childContainer.firstChild);
        }
        originalEntries.forEach((obj) => {
          childContainer.appendChild(obj.domNode);
        });

        // no changes are applied to "data"
        cancelBtn.remove();
        saveBtn.remove();
        editKeyBtn.remove();
        addChildBtn.remove();

        // remove any position inputs / up/down from the DOM
        childOrder.forEach((obj) => {
          const h = obj.domNode.querySelector(".item-header");
          if (!h) return;
          const inputs = Array.from(h.querySelectorAll(".position-input, .pos-up-btn, .pos-down-btn"));
          inputs.forEach((inp) => inp.remove());
        });

        // restore normal mode
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });

      // Save => keep changes
      saveBtn.addEventListener("click", () => {
        // We reorder "data" according to childOrder
        applyNewOrderToData(data, childOrder, parent, key);

        // remove the edit-mode buttons
        cancelBtn.remove();
        saveBtn.remove();
        editKeyBtn.remove();
        addChildBtn.remove();

        // remove position inputs and arrow buttons
        childOrder.forEach((obj) => {
          const h = obj.domNode.querySelector(".item-header");
          if (!h) return;
          const inputs = Array.from(h.querySelectorAll(".position-input, .pos-up-btn, .pos-down-btn"));
          inputs.forEach((inp) => inp.remove());
        });

        // remain expanded
        // show normal mode
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });

      // Edit Key => rename this property in the parent
      editKeyBtn.addEventListener("click", () => {
        if (!parent || key === "") return;
        // Hide new buttons
        cancelBtn.style.display = "none";
        saveBtn.style.display = "none";
        editKeyBtn.style.display = "none";
        addChildBtn.style.display = "none";

        const oldKey = String(key);
        const input = document.createElement("input");
        input.type = "text";
        input.value = oldKey;
        input.size = oldKey.length + 1;

        headerSpan.insertBefore(input, keySpan);
        keySpan.style.display = "none";

        const tmpCancel = document.createElement("button");
        tmpCancel.textContent = "Cancel";
        headerSpan.appendChild(tmpCancel);

        const tmpSave = document.createElement("button");
        tmpSave.textContent = "Save";
        headerSpan.appendChild(tmpSave);

        tmpCancel.addEventListener("click", () => {
          // revert
          input.remove();
          tmpCancel.remove();
          tmpSave.remove();
          keySpan.style.display = "inline";
          // restore
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editKeyBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });

        tmpSave.addEventListener("click", () => {
          const newKey = input.value.trim();
          if (newKey && newKey !== oldKey) {
            if (Array.isArray(parent)) {
              alert("Cannot rename an array index.");
            } else {
              parent[newKey] = data;
              delete parent[oldKey];
            }
          }
          keySpan.textContent = newKey + ": ";
          input.remove();
          tmpCancel.remove();
          tmpSave.remove();
          keySpan.style.display = "inline";
          // restore
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editKeyBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });
      });

      // Add Child => top insertion
      addChildBtn.addEventListener("click", () => {
        if (Array.isArray(data)) {
          data.unshift({ "new child": "" });
        } else {
          const old = Object.entries(data);
          const newObj = { "new child": "" };
          for (const [k, v] of old) {
            newObj[k] = v;
          }
          if (parent && !Array.isArray(parent)) {
            parent[key] = newObj;
          } else if (parent && Array.isArray(parent)) {
            const i = parent.indexOf(data);
            if (i >= 0) parent[i] = newObj;
          } else {
            jsonData = newObj;
          }
          data = newObj;
        }
        // rebuild
        childContainer.innerHTML = "";
        const newEntries = buildEntriesArray(data);
        newEntries.forEach((childEntry, i) => {
          const childNode = createJsonNode(childEntry.value, data, childEntry.key, true);
          childNode.setAttribute("data-child-index", i);
          childContainer.appendChild(childNode);
        });
        // re-add position controls
        // We won't keep "originalEntries" updated for Add Child; you can remove it if you like
        // or just consider "Cancel" won't revert brand-new children. (Up to you.)
        enablePositionControlsImmediate(childContainer);
      });
    });

    // Delete => remove from parent's data
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
        // it was root
        jsonData = {};
      }
      wrapper.remove();
    });
  } else {
    /****************************************************************
     * LEAF NODE (PRIMITIVE: string, number, boolean, null)
     ****************************************************************/
    const valueSpan = document.createElement("span");
    valueSpan.textContent = data;
    headerSpan.appendChild(valueSpan);

    toggleBtn.style.display = "none"; // no children => no expand/collapse

    // Normal mode: "Edit" / "Delete"
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    headerSpan.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    headerSpan.appendChild(deleteBtn);

    editBtn.addEventListener("click", () => {
      // Hide normal
      editBtn.style.display = "none";
      deleteBtn.style.display = "none";

      // Show "Cancel", "Save", "Edit Key", "Edit Value", "Add Child"
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      headerSpan.appendChild(cancelBtn);

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Save";
      headerSpan.appendChild(saveBtn);

      const editKeyBtn = document.createElement("button");
      editKeyBtn.textContent = "Edit Key";
      headerSpan.appendChild(editKeyBtn);

      const editValueBtn = document.createElement("button");
      editValueBtn.textContent = "Edit Value";
      headerSpan.appendChild(editValueBtn);

      const addChildBtn = document.createElement("button");
      addChildBtn.textContent = "Add Child";
      headerSpan.appendChild(addChildBtn);

      if (!parent || key === "") {
        editKeyBtn.style.display = "none"; // root primitive => no rename
      }

      // Cancel
      cancelBtn.addEventListener("click", () => {
        cancelBtn.remove();
        saveBtn.remove();
        editKeyBtn.remove();
        editValueBtn.remove();
        addChildBtn.remove();
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });

      // Save
      saveBtn.addEventListener("click", () => {
        cancelBtn.remove();
        saveBtn.remove();
        editKeyBtn.remove();
        editValueBtn.remove();
        addChildBtn.remove();
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });

      // Edit Key => rename the key in the parent
      editKeyBtn.addEventListener("click", () => {
        if (!parent || key === "") return;
        cancelBtn.style.display = "none";
        saveBtn.style.display = "none";
        editKeyBtn.style.display = "none";
        editValueBtn.style.display = "none";
        addChildBtn.style.display = "none";

        const oldKey = String(key);
        const input = document.createElement("input");
        input.type = "text";
        input.value = oldKey;
        input.size = oldKey.length + 1;

        headerSpan.insertBefore(input, keySpan);
        keySpan.style.display = "none";
        valueSpan.style.display = "none";

        const tmpCancel = document.createElement("button");
        tmpCancel.textContent = "Cancel";
        headerSpan.appendChild(tmpCancel);

        const tmpSave = document.createElement("button");
        tmpSave.textContent = "Save";
        headerSpan.appendChild(tmpSave);

        tmpCancel.addEventListener("click", () => {
          input.remove();
          tmpCancel.remove();
          tmpSave.remove();
          keySpan.style.display = "inline";
          valueSpan.style.display = "inline";
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editKeyBtn.style.display = "inline-block";
          editValueBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });

        tmpSave.addEventListener("click", () => {
          const newKey = input.value.trim();
          if (newKey && newKey !== oldKey) {
            if (Array.isArray(parent)) {
              alert("Cannot rename an array index.");
            } else {
              parent[newKey] = data;
              delete parent[oldKey];
            }
          }
          keySpan.textContent = newKey + ": ";
          input.remove();
          tmpCancel.remove();
          tmpSave.remove();
          keySpan.style.display = "inline";
          valueSpan.style.display = "inline";
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editKeyBtn.style.display = "inline-block";
          editValueBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });
      });

      // Edit Value => change the primitive
      editValueBtn.addEventListener("click", () => {
        cancelBtn.style.display = "none";
        saveBtn.style.display = "none";
        editKeyBtn.style.display = "none";
        editValueBtn.style.display = "none";
        addChildBtn.style.display = "none";

        const oldValStr = String(data);
        const input = document.createElement("input");
        input.type = "text";
        input.value = oldValStr;
        input.size = oldValStr.length + 1;

        headerSpan.insertBefore(input, valueSpan);
        valueSpan.style.display = "none";

        const tmpCancel = document.createElement("button");
        tmpCancel.textContent = "Cancel";
        headerSpan.appendChild(tmpCancel);

        const tmpSave = document.createElement("button");
        tmpSave.textContent = "Save";
        headerSpan.appendChild(tmpSave);

        tmpCancel.addEventListener("click", () => {
          input.remove();
          tmpCancel.remove();
          tmpSave.remove();
          valueSpan.style.display = "inline";
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editKeyBtn.style.display = "inline-block";
          editValueBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });

        tmpSave.addEventListener("click", () => {
          const newVal = input.value;
          if (parent) {
            if (Array.isArray(parent)) {
              const idx = parent.indexOf(data);
              if (idx >= 0) {
                parent[idx] = newVal;
              }
            } else {
              parent[key] = newVal;
            }
          } else {
            // root
            jsonData = newVal;
          }
          data = newVal;
          valueSpan.textContent = newVal;

          input.remove();
          tmpCancel.remove();
          tmpSave.remove();
          valueSpan.style.display = "inline";
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editKeyBtn.style.display = "inline-block";
          editValueBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });
      });

      // Add Child => transform the primitive into an object containing “old value” plus “new child”
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
          // root
          jsonData = newObj;
        }
        const newElem = createJsonNode(newObj, parent, key, false);
        wrapper.replaceWith(newElem);
      });
    });

    // Delete => remove from parent's data
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
        // root
        jsonData = {};
      }
      wrapper.remove();
    });
  }

  return wrapper;
}

/****************************************************************
 * HELPER: Build an array of { key, value } for an object or array
 ****************************************************************/
function buildEntriesArray(objOrArr) {
  if (Array.isArray(objOrArr)) {
    return objOrArr.map((val, idx) => ({ key: idx, value: val }));
  } else {
    return Object.keys(objOrArr).map((k) => ({
      key: k,
      value: objOrArr[k],
    }));
  }
}

/****************************************************************
 * HELPER: Move item in an array from oldIndex to newIndex
 ****************************************************************/
function moveItem(arr, oldIndex, newIndex) {
  if (newIndex >= arr.length) newIndex = arr.length - 1;
  if (newIndex < 0) newIndex = 0;
  if (oldIndex === newIndex) return;
  const [moved] = arr.splice(oldIndex, 1);
  arr.splice(newIndex, 0, moved);
}

/****************************************************************
 * HELPER: reorderDOM => reorder the childContainer DOM
 *         to match the array of {domNode} in childOrder
 ****************************************************************/
function reorderDOM(childOrder, container) {
  // remove all
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  // append in new order
  childOrder.forEach((obj) => {
    container.appendChild(obj.domNode);
  });
  // update each input's displayed position (1-based)
  childOrder.forEach((obj, i) => {
    const input = obj.domNode.querySelector(".position-input");
    if (input) input.value = String(i + 1);
  });
}

/****************************************************************
 * applyNewOrderToData => rewrite data (object or array)
 *     to match childOrder
 ****************************************************************/
function applyNewOrderToData(data, childOrder, parent, parentKey) {
  if (Array.isArray(data)) {
    data.length = 0;
    childOrder.forEach((obj) => {
      data.push(obj.value);
    });
  } else {
    // object
    const newObj = {};
    childOrder.forEach((obj) => {
      newObj[obj.key] = obj.value;
    });
    if (parent) {
      if (Array.isArray(parent)) {
        const idx = parent.indexOf(data);
        if (idx >= 0) {
          parent[idx] = newObj;
        }
      } else {
        parent[parentKey] = newObj;
      }
    } else {
      jsonData = newObj;
    }
  }
}

/****************************************************************
 * On addChild we might want to re-show position controls
 ****************************************************************/
function enablePositionControlsImmediate(childContainer) {
  // For each child, just do minimal “no-op” or re-run logic, if desired
  // We basically re-Edit. This is optional. If you want brand-new children
  // also to have position controls, call a small version of the logic here.
}
