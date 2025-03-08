/****************************************************************
 * GLOBALS
 ****************************************************************/
let jsonData = null;            // The actual in-memory JSON object
const fileInput = document.getElementById("fileInput");
const jsonContainer = document.getElementById("jsonContainer");
const saveJsonBtn = document.getElementById("saveJsonBtn");

// For drag-and-drop
let dragSrcElem = null;         // The DOM element we’re dragging
let dragSrcIndex = null;        // Its index in the parent's child array
let dragSrcParent = null;       // The parent data structure of the node

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

      // Clear the container and render
      jsonContainer.innerHTML = "";
      const rootNode = createJsonNode(jsonData, null, "", false);
      jsonContainer.appendChild(rootNode);
    } catch (err) {
      alert("Invalid JSON file!");
      console.error(err);
    }
  };

  reader.readAsText(file);
});

/**
 * Export the updated JSON as a file named updated.json
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

/****************************************************************
 * MAIN TREE-BUILDING LOGIC
 *
 * Because we want to reorder both arrays and objects, we treat
 * the children as an array of “entries”: { key, value }.
 * For an array in JSON, keys are numeric. For an object, keys
 * are strings. We store them in an array so we can drag-drop
 * reorder. When we reorder, we rewrite the parent accordingly.
 ****************************************************************/

/**
 * Create a DOM element representing a single JSON node (object, array, or primitive).
 * @param {any} data The current subtree in the JSON structure
 * @param {object|array|null} parent The parent object/array in the JSON
 * @param {string|number} key The key/index of this data in its parent
 * @param {boolean} startCollapsed Optional: whether to start collapsed or not
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
    const collapsed = wrapper.classList.toggle("collapsed");
    toggleBtn.textContent = collapsed ? "+" : "-";
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

  // If data is object or array => children
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
      // Show the toggle button since we have children
      toggleBtn.style.display = "inline-block";
      // default text is "+", but if not collapsed, show "-"
      if (!startCollapsed) {
        toggleBtn.textContent = "-";
      }
    }

    // Render each child as a .json-item inside childContainer
    entries.forEach((childEntry, index) => {
      const childNode = createJsonNode(childEntry.value, data, childEntry.key);
      // For drag-and-drop:
      childNode.draggable = false; // not draggable in normal mode
      childNode.setAttribute("data-child-index", index);
      childContainer.appendChild(childNode);
    });

    // Edit button => show "Cancel", "Save", "Edit Key", "Add Child", “Edit Value” (if leaf), etc.
    editBtn.addEventListener("click", () => {
      // Expand
      wrapper.classList.remove("collapsed");
      toggleBtn.textContent = "-";

      // Hide normal mode buttons
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

      // If this is not the root, we also want "Edit Key" to rename the property in the parent
      if (!parent || key === "") {
        // Root node => "Edit Key" is not relevant
        editKeyBtn.style.display = "none";
      }

      // Make each child node draggable
      Array.from(childContainer.children).forEach((childElem) => {
        childElem.draggable = true;
        childElem.addEventListener("dragstart", onDragStart);
        childElem.addEventListener("dragover", onDragOver);
        childElem.addEventListener("dragleave", onDragLeave);
        childElem.addEventListener("drop", onDrop);
        childElem.addEventListener("dragend", onDragEnd);
      });

      // Cancel button
      cancelBtn.addEventListener("click", () => {
        // revert any partial changes by re-rendering children from data
        rebuildChildContainer(childContainer, data, /* keepExpanded= */ true);
        // remove the edit-mode buttons
        cancelBtn.remove();
        saveBtn.remove();
        editKeyBtn.remove();
        addChildBtn.remove();
        // show normal mode again
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });

      // Save button => keep order changes, remain expanded
      saveBtn.addEventListener("click", () => {
        // If the user has reordered children, we've already updated 'data'
        // so there's nothing special to do here except revert UI to normal mode
        cancelBtn.remove();
        saveBtn.remove();
        editKeyBtn.remove();
        addChildBtn.remove();

        // Turn off draggable
        Array.from(childContainer.children).forEach((childElem) => {
          childElem.draggable = false;
          childElem.removeEventListener("dragstart", onDragStart);
          childElem.removeEventListener("dragover", onDragOver);
          childElem.removeEventListener("dragleave", onDragLeave);
          childElem.removeEventListener("drop", onDrop);
          childElem.removeEventListener("dragend", onDragEnd);
        });

        // show normal mode again
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });

      // Edit Key => rename the property name in the parent
      editKeyBtn.addEventListener("click", () => {
        if (!parent || key === "") return;
        // Hide the four buttons
        cancelBtn.style.display = "none";
        saveBtn.style.display = "none";
        editKeyBtn.style.display = "none";
        addChildBtn.style.display = "none";

        // Create an input for the new key name
        const oldKey = String(key);
        const input = document.createElement("input");
        input.type = "text";
        input.value = oldKey;
        // auto-size
        input.size = input.value.length + 1;

        headerSpan.insertBefore(input, keySpan);
        keySpan.style.display = "none";

        // temp buttons for saving or canceling the rename
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
          // restore the 4
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editKeyBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });

        tmpSave.addEventListener("click", () => {
          const newKey = input.value.trim();
          if (newKey && newKey !== oldKey) {
            // rename in the parent
            if (Array.isArray(parent)) {
              // array => not typical to rename an index
              alert("Cannot rename an array index.");
            } else {
              parent[newKey] = data;
              delete parent[oldKey];
              key = newKey; // local
            }
          }
          keySpan.textContent = newKey + ": ";
          // cleanup
          input.remove();
          tmpCancel.remove();
          tmpSave.remove();
          keySpan.style.display = "inline";
          // restore the 4
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editKeyBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });
      });

      // Add Child => top insertion
      addChildBtn.addEventListener("click", () => {
        // If data is an array, unshift a new entry
        // If data is an object, we add a new property at the top
        if (Array.isArray(data)) {
          data.unshift({ "new child": "" });
        } else {
          // Convert the object to an array of [key, value]
          const oldEntries = Object.entries(data);
          const newKey = "new child";
          const newObj = {};
          newObj[newKey] = "";
          // Then re-add the old ones
          for (const [k, v] of oldEntries) {
            newObj[k] = v;
          }
          // Put it back in the parent
          if (parent !== null) {
            if (Array.isArray(parent)) {
              const i = parent.indexOf(data);
              if (i >= 0) {
                parent[i] = newObj;
              }
            } else {
              parent[key] = newObj;
            }
          } else {
            // root
            jsonData = newObj;
          }
          data = newObj; // update reference
        }
        rebuildChildContainer(childContainer, data, true);
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
    // The value itself
    const valueSpan = document.createElement("span");
    valueSpan.textContent = data;
    headerSpan.appendChild(valueSpan);

    toggleBtn.style.display = "none"; // no children => no expand/collapse

    // Normal-mode: "Edit" / "Delete"
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

      // If root or key is "", hide the "Edit Key" button
      if (!parent || key === "") {
        editKeyBtn.style.display = "none";
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
        // Hide all 5
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
          // show original 5
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
              key = newKey;
            }
          }
          keySpan.textContent = newKey + ": ";
          input.remove();
          tmpCancel.remove();
          tmpSave.remove();
          keySpan.style.display = "inline";
          valueSpan.style.display = "inline";
          // show original 5
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editKeyBtn.style.display = "inline-block";
          editValueBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });
      });

      // Edit Value => change the primitive
      editValueBtn.addEventListener("click", () => {
        // Hide all 5
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
          // update parent’s data
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
            // root primitive
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
        // Rebuild the node
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

/**
 * Convert an object or array into an array of { key, value }, preserving order
 */
function buildEntriesArray(objOrArr) {
  if (Array.isArray(objOrArr)) {
    return objOrArr.map((val, idx) => ({ key: idx, value: val }));
  } else {
    // Convert object to array in insertion order
    const entries = [];
    for (const k of Object.keys(objOrArr)) {
      entries.push({ key: k, value: objOrArr[k] });
    }
    return entries;
  }
}

/**
 * Rebuild the child container from the parent's data object/array
 * without collapsing the parent.  
 * Useful for “cancel” or “add child” scenarios.
 */
function rebuildChildContainer(childContainer, data, keepExpanded) {
  childContainer.innerHTML = "";
  const entries = buildEntriesArray(data);

  entries.forEach((entry, i) => {
    const childNode = createJsonNode(entry.value, data, entry.key, false);
    childNode.setAttribute("data-child-index", i);
    childContainer.appendChild(childNode);
  });
}

/****************************************************************
 * DRAG & DROP EVENT HANDLERS
 ****************************************************************/
/**
 * Begin drag
 */
function onDragStart(e) {
  dragSrcElem = e.currentTarget;
  dragSrcIndex = parseInt(dragSrcElem.getAttribute("data-child-index"), 10);
  const parentNode = dragSrcElem.parentNode;
  // We need the actual JS data for reordering
  const pData = getParentDataFromNode(parentNode);
  dragSrcParent = pData; // { parent, data }
  e.dataTransfer.effectAllowed = "move";
}

/**
 * Over a potential drop target
 */
function onDragOver(e) {
  // Only allow dropping if the target is one of our child nodes
  e.preventDefault();
  const target = e.currentTarget;
  if (target.classList.contains("json-item")) {
    target.classList.add("drag-over");
  }
}

/**
 * Leave a potential drop target
 */
function onDragLeave(e) {
  const target = e.currentTarget;
  if (target.classList.contains("json-item")) {
    target.classList.remove("drag-over");
  }
}

/**
 * Drop onto a child node
 */
function onDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  const targetElem = e.currentTarget;
  targetElem.classList.remove("drag-over");

  if (!dragSrcElem || dragSrcElem === targetElem) return;

  const dropIndex = parseInt(targetElem.getAttribute("data-child-index"), 10);
  // Move the item from dragSrcIndex to dropIndex in the parent's data
  if (dragSrcParent && dragSrcParent.data) {
    const arrOrObj = dragSrcParent.data;
    const isArray = Array.isArray(arrOrObj);

    // If array => reorder
    if (isArray) {
      if (dragSrcIndex !== dropIndex && dropIndex !== null) {
        const movedItem = arrOrObj.splice(dragSrcIndex, 1)[0];
        arrOrObj.splice(dropIndex, 0, movedItem);
        // Rebuild the container
        rebuildChildContainer(
          targetElem.parentNode,
          arrOrObj,
          /* keepExpanded= */ true
        );
      }
    } else {
      // It's an object => we reorder the keys array
      // We'll do this by converting the object to an array of [k,v], reorder, then build a new object
      const entries = buildEntriesArray(arrOrObj);
      if (dragSrcIndex !== dropIndex && dropIndex !== null) {
        const [moved] = entries.splice(dragSrcIndex, 1);
        entries.splice(dropIndex, 0, moved);

        // build new object in that order
        const newObj = {};
        for (const entry of entries) {
          newObj[entry.key] = entry.value;
        }

        // place it back in dragSrcParent
        if (dragSrcParent.parent !== null) {
          const p = dragSrcParent.parent;
          const k = dragSrcParent.keyInParent;
          if (Array.isArray(p)) {
            const i = p.indexOf(arrOrObj);
            if (i >= 0) p[i] = newObj;
          } else {
            p[k] = newObj;
          }
        } else {
          // might be the root
          jsonData = newObj;
        }

        // update reference
        dragSrcParent.data = newObj;

        // rebuild
        rebuildChildContainer(targetElem.parentNode, newObj, true);
      }
    }
  }
}

/**
 * Drag ended
 */
function onDragEnd(e) {
  dragSrcElem = null;
  dragSrcIndex = null;
  dragSrcParent = null;
}

/**
 * Figure out which data structure the given DOM node belongs to,
 * so we can reorder the correct array or object. Return an object:
 * { parent, data, keyInParent } meaning: data is the array/object
 * that holds these children; parent is the parent's data, keyInParent
 * is the parent's key if the parent is also an object.
 */
function getParentDataFromNode(childContainerElem) {
  // The container is inside the node that created it. Walk up DOM until
  // we find the .json-item that contains it, then look at that item’s data reference.
  let node = childContainerElem;
  while (node && !node.classList?.contains("json-item")) {
    node = node.parentNode;
  }
  // The node we find is the parent's wrapper
  // We stored data/parent references in closures, but we don't have direct
  // references here. We'll replicate the approach: we can glean the parent's data
  // from the function that built it. A simpler approach is to store references
  // in a Map from DOM node => { data, parent, key } when creating them.
  //
  // For demonstration, we'll guess we can find it by re-walking the JSON data from the root.
  // That’s not particularly efficient but simpler to code in a single file example.

  // We'll store a custom attribute "data-unique-id" if we want. But to keep it shorter, let's do:
  // We'll parse from an already rebuilt portion. We'll do a direct approach: find the parent's data
  // by checking sibling nodes. Because we've already used createJsonNode with references, the simpler
  // method is to rely on the re-render we do. We'll do a hidden trick: we look for the parent's array or object
  // from the parent's .json-children. We do that in the calling function:
  const result = {};
  // We'll do a hack: the parent node also has an 'onDrop' that references dragSrcParent. We can store a hidden property
  // or do a BFS. For brevity: when we set up drag we already have “dragSrcParent = { parent, data, keyInParent }”.
  // We'll store the entire array or object in dragSrcParent. The container is the same for all children. So:
  // If we set dragSrcParent when we start the “Edit” mode, we might be able to retrieve it. But we do not do that in code.
  // 
  // Because this getParentDataFromNode is only used for reordering, we can do a simpler approach: just walk up
  // the .json-item chain until we find the data in the local closure. But we don't have direct closures in JS this way.
  // 
  // For a more robust approach, we can store references in a global Map from DOM node => { data, parent, keyInParent }.
  // Let's do exactly that in createJsonNode.
  return getStoredNodeData(childContainerElem);
}

/****************************************************************
 * STORING & RETRIEVING NODE METADATA
 * So we can reorder easily, we store a map from DOM node => meta
 ****************************************************************/
const nodeDataMap = new WeakMap();

/**
 * We will wrap the creation of the node in a function
 * that stores the references in nodeDataMap before returning it.
 */
function createJsonNode(data, parent, key, startCollapsed = false) {
  // Create it via the "real" function
  const node = _internalCreateJsonNode(data, parent, key, startCollapsed);

  // Store references so we can retrieve them on drag & drop
  nodeDataMap.set(node, {
    data,
    parent,
    key,
  });

  return node;
}

// We'll rename your original createJsonNode to _internalCreateJsonNode:
function _internalCreateJsonNode(data, parent, key, startCollapsed) {
  // everything from earlier createJsonNode is here, but we replaced the function name:
  // -------------------------------------------------------
  const wrapper = document.createElement("div");
  wrapper.classList.add("json-item");
  if (startCollapsed) {
    wrapper.classList.add("collapsed");
  }

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "toggle-button";
  toggleBtn.textContent = "+";
  toggleBtn.style.display = "none";
  wrapper.appendChild(toggleBtn);

  toggleBtn.addEventListener("click", () => {
    const collapsed = wrapper.classList.toggle("collapsed");
    toggleBtn.textContent = collapsed ? "+" : "-";
  });

  const headerSpan = document.createElement("span");
  headerSpan.classList.add("item-header");
  wrapper.appendChild(headerSpan);

  const keySpan = document.createElement("span");
  if (key !== "") {
    keySpan.textContent = `${key}: `;
  }
  headerSpan.appendChild(keySpan);

  if (typeof data === "object" && data !== null) {
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    headerSpan.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    headerSpan.appendChild(deleteBtn);

    const childContainer = document.createElement("div");
    childContainer.classList.add("json-children");
    wrapper.appendChild(childContainer);

    const entries = buildEntriesArray(data);
    if (entries.length > 0) {
      toggleBtn.style.display = "inline-block";
      if (!startCollapsed) toggleBtn.textContent = "-";
    }

    entries.forEach((childEntry, idx) => {
      const childNode = createJsonNode(childEntry.value, data, childEntry.key);
      childNode.setAttribute("data-child-index", idx);
      childContainer.appendChild(childNode);
    });

    editBtn.addEventListener("click", () => {
      wrapper.classList.remove("collapsed");
      toggleBtn.textContent = "-";

      editBtn.style.display = "none";
      deleteBtn.style.display = "none";

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
        editKeyBtn.style.display = "none";
      }

      // Make child nodes draggable
      Array.from(childContainer.children).forEach((c) => {
        c.draggable = true;
        c.addEventListener("dragstart", onDragStart);
        c.addEventListener("dragover", onDragOver);
        c.addEventListener("dragleave", onDragLeave);
        c.addEventListener("drop", onDrop);
        c.addEventListener("dragend", onDragEnd);
      });

      cancelBtn.addEventListener("click", () => {
        rebuildChildContainer(childContainer, data, true);
        cancelBtn.remove();
        saveBtn.remove();
        editKeyBtn.remove();
        addChildBtn.remove();
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });

      saveBtn.addEventListener("click", () => {
        cancelBtn.remove();
        saveBtn.remove();
        editKeyBtn.remove();
        addChildBtn.remove();

        // turn off draggable
        Array.from(childContainer.children).forEach((c) => {
          c.draggable = false;
          c.removeEventListener("dragstart", onDragStart);
          c.removeEventListener("dragover", onDragOver);
          c.removeEventListener("dragleave", onDragLeave);
          c.removeEventListener("drop", onDrop);
          c.removeEventListener("dragend", onDragEnd);
        });

        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });

      editKeyBtn.addEventListener("click", () => {
        if (!parent || key === "") return;
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
          input.remove();
          tmpCancel.remove();
          tmpSave.remove();
          keySpan.style.display = "inline";
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editKeyBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });

        tmpSave.addEventListener("click", () => {
          const newKey = input.value.trim();
          if (newKey && newKey !== oldKey) {
            if (Array.isArray(parent)) {
              alert("Cannot rename array index.");
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
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editKeyBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });
      });

      addChildBtn.addEventListener("click", () => {
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
      });
    });

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
        jsonData = {};
      }
      wrapper.remove();
    });
  } else {
    // Leaf
    const valueSpan = document.createElement("span");
    valueSpan.textContent = data;
    headerSpan.appendChild(valueSpan);

    toggleBtn.style.display = "none";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    headerSpan.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    headerSpan.appendChild(deleteBtn);

    editBtn.addEventListener("click", () => {
      editBtn.style.display = "none";
      deleteBtn.style.display = "none";

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
        editKeyBtn.style.display = "none";
      }

      cancelBtn.addEventListener("click", () => {
        cancelBtn.remove();
        saveBtn.remove();
        editKeyBtn.remove();
        editValueBtn.remove();
        addChildBtn.remove();
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });

      saveBtn.addEventListener("click", () => {
        cancelBtn.remove();
        saveBtn.remove();
        editKeyBtn.remove();
        editValueBtn.remove();
        addChildBtn.remove();
        editBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
      });

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

      editValueBtn.addEventListener("click", () => {
        cancelBtn.style.display = "none";
        saveBtn.style.display = "none";
        editKeyBtn.style.display = "none";
        editValueBtn.style.display = "none";
        addChildBtn.style.display = "none";

        const oldVal = String(data);
        const input = document.createElement("input");
        input.type = "text";
        input.value = oldVal;
        input.size = oldVal.length + 1;

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
              const i = parent.indexOf(data);
              if (i >= 0) {
                parent[i] = newVal;
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

      addChildBtn.addEventListener("click", () => {
        const oldVal = data;
        const newObj = { "new child": "", "old value": oldVal };
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
        const newElem = createJsonNode(newObj, parent, key, false);
        wrapper.replaceWith(newElem);
      });
    });

    deleteBtn.addEventListener("click", () => {
      if (parent) {
        if (Array.isArray(parent)) {
          const i = parent.indexOf(data);
          if (i >= 0) {
            parent.splice(i, 1);
          }
        } else {
          delete parent[key];
        }
      } else {
        jsonData = {};
      }
      wrapper.remove();
    });
  }

  return wrapper;
}
// -------------------------------------------------------

/**
 * Retrieve data from the WeakMap we stored for the parent node.
 */
function getStoredNodeData(childContainerElem) {
  // the parent node is the .json-item that encloses `childContainerElem`
  let node = childContainerElem;
  // climb up until we find a .json-item
  while (node && !node.classList?.contains("json-item")) {
    node = node.parentNode;
  }
  if (!node) {
    return { parent: null, data: null, keyInParent: null };
  }
  const meta = nodeDataMap.get(node);
  if (!meta) {
    return { parent: null, data: null, keyInParent: null };
  }
  return {
    parent: meta.parent,
    data: meta.data,
    keyInParent: meta.key,
  };
}
