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

    // Build an array of entries so we can reorder them
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

      // We'll store a snapshot of the original ordering so "Cancel" can revert
      // Make a deep copy of the entries order
      const originalEntries = buildEntriesArray(data).map((e) => ({ ...e }));

      // Show position + up/down controls on each child
      enablePositionControls(childContainer, data, parent, key);

      // Cancel => revert
      cancelBtn.addEventListener("click", () => {
        // Rebuild the parent's data using the original order
        if (Array.isArray(data)) {
          data.length = 0; // clear
          originalEntries.forEach((ent) => data.push(ent.value));
        } else {
          // object
          const newObj = {};
          originalEntries.forEach((ent) => {
            newObj[ent.key] = ent.value;
          });
          if (parent) {
            if (Array.isArray(parent)) {
              const i = parent.indexOf(data);
              if (i >= 0) {
                parent[i] = newObj;
              }
            } else {
              parent[key] = newObj;
            }
          } else {
            jsonData = newObj;
          }
          // update reference
          data = newObj;
        }

        // remove the edit-mode buttons
        cancelBtn.remove();
        saveBtn.remove();
        editKeyBtn.remove();
        addChildBtn.remove();

        // re-render children from data
        rebuildChildContainer(childContainer, data, /* keepCollapsed= */ true);

        // restore normal mode
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });

      // Save => keep changes
      saveBtn.addEventListener("click", () => {
        // Remove the edit-mode buttons
        cancelBtn.remove();
        saveBtn.remove();
        editKeyBtn.remove();
        addChildBtn.remove();

        // remove position inputs and arrow buttons
        Array.from(childContainer.children).forEach((childElem) => {
          const posInput = childElem.querySelector(".position-input");
          if (posInput) posInput.remove();
          const upBtn = childElem.querySelector(".pos-up-btn");
          if (upBtn) upBtn.remove();
          const downBtn = childElem.querySelector(".pos-down-btn");
          if (downBtn) downBtn.remove();
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
        // If data is an array, unshift a new entry
        // If data is an object, we create a new object with new child first
        if (Array.isArray(data)) {
          data.unshift({ "new child": "" });
        } else {
          const oldEntries = Object.entries(data);
          const newObj = { "new child": "" };
          for (const [k, v] of oldEntries) {
            newObj[k] = v;
          }
          if (parent) {
            if (Array.isArray(parent)) {
              const i = parent.indexOf(data);
              if (i >= 0) {
                parent[i] = newObj;
              }
            } else {
              parent[key] = newObj;
            }
          } else {
            jsonData = newObj;
          }
          data = newObj;
        }
        rebuildChildContainer(childContainer, data, true);
        enablePositionControls(childContainer, data, parent, key);
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
      if (parent) {
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
 * enablePositionControls:
 *    In "Edit" mode for an object/array, each child gets:
 *       1) a <input type="number"> for the child’s 1-based position
 *       2) an up-arrow (▲) button to move up by 1
 *       3) a down-arrow (▼) button to move down by 1
 *    Changing the number and pressing Enter repositions the item
 *    (if within range). The up/down buttons reorder immediately.
 ****************************************************************/
function enablePositionControls(childContainer, data, parent, parentKey) {
  const children = Array.from(childContainer.children);
  const total = children.length;

  children.forEach((childElem, i) => {
    const firstHeader = childElem.querySelector(".item-header");
    if (!firstHeader) return;

    // If there's already an input, remove it and re-add fresh
    const oldInput = firstHeader.querySelector(".position-input");
    if (oldInput) oldInput.remove();
    const oldUp = firstHeader.querySelector(".pos-up-btn");
    if (oldUp) oldUp.remove();
    const oldDown = firstHeader.querySelector(".pos-down-btn");
    if (oldDown) oldDown.remove();

    // Create the number input
    const posInput = document.createElement("input");
    posInput.type = "number";
    posInput.className = "position-input";
    posInput.value = (i + 1).toString(); // 1-based
    posInput.min = "1";
    posInput.max = String(total);

    // On Enter, reorder to typed position
    posInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        let newPos = parseInt(posInput.value, 10);
        if (isNaN(newPos)) return;
        if (newPos < 1 || newPos > total) return; // out of range => do nothing
        const oldIndex = i;
        const newIndex = newPos - 1;
        if (newIndex !== oldIndex) {
          reorderChild(data, oldIndex, newIndex, parent, parentKey);
          rebuildChildContainer(childContainer, data, /* keepCollapsed= */ true);
          enablePositionControls(childContainer, data, parent, parentKey);
        }
      }
    });

    // Up button
    const upBtn = document.createElement("button");
    upBtn.className = "pos-up-btn";
    upBtn.textContent = "▲";
    upBtn.addEventListener("click", () => {
      // Move this item up 1
      if (i > 0) {
        reorderChild(data, i, i - 1, parent, parentKey);
        rebuildChildContainer(childContainer, data, true);
        enablePositionControls(childContainer, data, parent, parentKey);
      }
    });

    // Down button
    const downBtn = document.createElement("button");
    downBtn.className = "pos-down-btn";
    downBtn.textContent = "▼";
    downBtn.addEventListener("click", () => {
      // Move this item down 1
      if (i < total - 1) {
        reorderChild(data, i, i + 1, parent, parentKey);
        rebuildChildContainer(childContainer, data, true);
        enablePositionControls(childContainer, data, parent, parentKey);
      }
    });

    // Insert them in front
    firstHeader.insertBefore(downBtn, firstHeader.firstChild);
    firstHeader.insertBefore(upBtn, firstHeader.firstChild);
    firstHeader.insertBefore(posInput, firstHeader.firstChild);
  });
}

/****************************************************************
 * SHIFT CHILD POSITIONS
 ****************************************************************/
/**
 * Reorder the child within parentData, moving from oldIndex to newIndex.
 * If parentData is an array => splice.
 * If parentData is an object => reorder the object's entries in array form.
 */
function reorderChild(parentData, oldIndex, newIndex, parent, parentKey) {
  if (Array.isArray(parentData)) {
    if (newIndex < 0 || newIndex >= parentData.length) return;
    const [moved] = parentData.splice(oldIndex, 1);
    parentData.splice(newIndex, 0, moved);
  } else {
    // object => reorder its keys
    const entries = Object.entries(parentData);
    if (newIndex < 0 || newIndex >= entries.length) return;
    const [moved] = entries.splice(oldIndex, 1);
    entries.splice(newIndex, 0, moved);

    // reconstruct the object
    const newObj = {};
    for (const [k, v] of entries) {
      newObj[k] = v;
    }

    // place it back into its parent
    if (parent) {
      if (Array.isArray(parent)) {
        const i = parent.indexOf(parentData);
        if (i >= 0) {
          parent[i] = newObj;
        }
      } else {
        parent[parentKey] = newObj;
      }
    } else {
      // root
      jsonData = newObj;
    }
  }
}

/****************************************************************
 * BUILD ENTRIES ARRAY
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
 * REBUILD CHILDREN
 ****************************************************************/
function rebuildChildContainer(childContainer, parentData, keepCollapsed) {
  childContainer.innerHTML = "";
  const entries = buildEntriesArray(parentData);
  entries.forEach((childEntry, index) => {
    // keep each child collapsed by default if keepCollapsed==true
    const childNode = createJsonNode(childEntry.value, parentData, childEntry.key, keepCollapsed);
    childNode.setAttribute("data-child-index", index);
    childContainer.appendChild(childNode);
  });
}
