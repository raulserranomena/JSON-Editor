let jsonData = null; // This will store the raw JS object we load from the fileInput
const fileInput = document.getElementById("fileInput");
const jsonContainer = document.getElementById("jsonContainer");
const saveJsonBtn = document.getElementById("saveJsonBtn");

/**
 * Reads the selected file and parses it as JSON.
 */
fileInput.addEventListener("change", function () {
  if (!fileInput.files || fileInput.files.length === 0) return;
  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      jsonData = JSON.parse(e.target.result);
      renderJSON(jsonData, jsonContainer);
    } catch (err) {
      alert("Invalid JSON file!");
      console.error(err);
    }
  };

  reader.readAsText(file);
});

/**
 * Convert the JS object into an interactive, nested list in the DOM.
 * @param {any} data  The data (object, array, or primitive) to be rendered.
 * @param {HTMLElement} container The DOM node where this data should be appended.
 * @param {string|number} key The property name or index of the current item.
 * @param {object|null} parent Parent reference for deletion or updates.
 */
function renderJSON(data, container, key = "", parent = null) {
  // Create a wrapper item
  const itemWrapper = document.createElement("div");
  itemWrapper.classList.add("json-item", "collapsed"); // By default, collapsed
  container.appendChild(itemWrapper);

  // Create a small toggle button to expand/collapse
  const toggleBtn = document.createElement("button");
  toggleBtn.classList.add("toggle-button");
  toggleBtn.textContent = "+";
  toggleBtn.addEventListener("click", () => {
    const isCollapsed = itemWrapper.classList.toggle("collapsed");
    toggleBtn.textContent = isCollapsed ? "+" : "-";
  });
  itemWrapper.appendChild(toggleBtn);

  // Create a container for the header info (key, buttons, etc.)
  const headerSpan = document.createElement("span");
  headerSpan.classList.add("item-header");
  itemWrapper.appendChild(headerSpan);

  // Display the key (or index) for this item
  const keySpan = document.createElement("span");
  keySpan.textContent = key !== "" ? `${key}: ` : ""; // hide if root
  headerSpan.appendChild(keySpan);

  // Detect if data is an object or array
  if (typeof data === "object" && data !== null) {
    // This node has children
    const childrenContainer = document.createElement("div");
    childrenContainer.classList.add("json-children");
    itemWrapper.appendChild(childrenContainer);

    // Create edit/delete button row for this parent
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    headerSpan.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    headerSpan.appendChild(deleteBtn);

    // Expand vs collapse display
    toggleBtn.style.display = "inline-block";

    // If it's an array, iterate by index; if object, iterate by property key
    const entries = Array.isArray(data)
      ? data.map((val, idx) => ({ key: idx, value: val }))
      : Object.entries(data).map(([k, v]) => ({ key: k, value: v }));

    // Recursively render each child
    entries.forEach((child) => {
      renderJSON(child.value, childrenContainer, child.key, data);
    });

    // Handle “Edit” button
    editBtn.addEventListener("click", () => {
      // Expand this item so we see all children
      itemWrapper.classList.remove("collapsed");
      toggleBtn.textContent = "-";

      // Hide the normal edit/delete buttons
      editBtn.style.display = "none";
      deleteBtn.style.display = "none";

      // Create “Cancel”, “Save”, “Edit text”, “Add child” for the parent
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      const saveBtn = document.createElement("button");
      saveBtn.textContent = "Save";
      const editTextBtn = document.createElement("button");
      editTextBtn.textContent = "Edit text";
      const addChildBtn = document.createElement("button");
      addChildBtn.textContent = "Add child";

      headerSpan.appendChild(cancelBtn);
      headerSpan.appendChild(saveBtn);
      headerSpan.appendChild(editTextBtn);
      headerSpan.appendChild(addChildBtn);

      // For each child, show “delete” button (it already exists inside them if we handle it similarly),
      // but you might want to handle other per-child changes here, too.

      // “Edit text” button: let the user rename this key (if it has one) or rename the root
      editTextBtn.addEventListener("click", () => {
        // Hide all other controls
        cancelBtn.style.display = "none";
        saveBtn.style.display = "none";
        editTextBtn.style.display = "none";
        addChildBtn.style.display = "none";

        // Create an input to edit the key text
        const oldKey = keySpan.textContent.replace(/:$/, "").trim();
        const textInput = document.createElement("input");
        textInput.type = "text";
        textInput.value = oldKey;
        headerSpan.insertBefore(textInput, headerSpan.firstChild);

        // Show only “Cancel” and “Save” – re-use them or create new ones
        const tempCancel = document.createElement("button");
        const tempSave = document.createElement("button");
        tempCancel.textContent = "Cancel";
        tempSave.textContent = "Save";

        headerSpan.appendChild(tempCancel);
        headerSpan.appendChild(tempSave);

        // On “Cancel”, revert
        tempCancel.addEventListener("click", () => {
          textInput.remove();
          tempCancel.remove();
          tempSave.remove();
          // Return to previous edit-state controls
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editTextBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });

        // On “Save”, update the key
        tempSave.addEventListener("click", () => {
          keySpan.textContent = textInput.value + ": ";
          textInput.remove();
          tempCancel.remove();
          tempSave.remove();
          // Return to previous edit-state controls
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editTextBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });
      });

      // “Add child” button
      addChildBtn.addEventListener("click", () => {
        // If data is an object or array, just push a new child
        // If it's an array, push at index 0, if it's an object, add a new property
        if (Array.isArray(data)) {
          data.unshift({ "new child": "" });
        } else {
          // Add a default new key to the front
          // There's no stable "front" in an object, but we can store it logically
          // We'll call it "new child". If the key collides, rename as needed.
          data["new child"] = "";
        }
        // Re-render from the parent container
        reRender();
      });

      // “Cancel” – restore old UI
      cancelBtn.addEventListener("click", () => {
        reRender(); // Just revert everything by re-rendering
      });

      // “Save” – keep changes, but exit edit mode
      saveBtn.addEventListener("click", () => {
        // If you have logic to do partial saving, handle it here.
        // Right now we just accept the changes in memory and re-render.
        reRender();
      });
    });

    // “Delete” – remove this object from its parent
    deleteBtn.addEventListener("click", () => {
      if (parent !== null) {
        if (Array.isArray(parent)) {
          // parent is an array, so find index
          const index = parent.indexOf(data);
          if (index > -1) {
            parent.splice(index, 1);
          }
        } else {
          // parent is an object, remove key
          delete parent[key];
        }
        reRender();
      } else {
        // If there's no parent, this is the top-level object, so clear everything
        jsonData = {};
        renderJSON(jsonData, jsonContainer);
      }
    });
  } else {
    // data is a primitive
    // Show the value
    const valueSpan = document.createElement("span");
    valueSpan.textContent = data;
    headerSpan.appendChild(valueSpan);

    // Normal mode: "Edit" and "Delete"
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    headerSpan.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    headerSpan.appendChild(deleteBtn);

    // There's no need for a toggle in a leaf
    toggleBtn.style.display = "none";

    // If there's a primitive value, we can show an "edit value" mode or
    // follow the specification about "edit text" or "edit value"
    // We'll keep it simple: "edit" => "Cancel"/"Save"/"Edit text"/"Add child"
    editBtn.addEventListener("click", () => {
      // Hide normal buttons
      editBtn.style.display = "none";
      deleteBtn.style.display = "none";

      // Create “Cancel”, “Save”, “Edit text”, “Add child”
      const cancelBtn = document.createElement("button");
      const saveBtn = document.createElement("button");
      const editTextBtn = document.createElement("button");
      const addChildBtn = document.createElement("button");

      cancelBtn.textContent = "Cancel";
      saveBtn.textContent = "Save";
      editTextBtn.textContent = "Edit text";
      addChildBtn.textContent = "Add child";

      headerSpan.appendChild(cancelBtn);
      headerSpan.appendChild(saveBtn);
      headerSpan.appendChild(editTextBtn);
      headerSpan.appendChild(addChildBtn);

      // “Edit text”: we let user directly edit the value
      editTextBtn.addEventListener("click", () => {
        // Hide these four
        cancelBtn.style.display = "none";
        saveBtn.style.display = "none";
        editTextBtn.style.display = "none";
        addChildBtn.style.display = "none";

        // Create input
        const textInput = document.createElement("input");
        textInput.type = "text";
        textInput.value = data; // old value
        headerSpan.insertBefore(textInput, valueSpan);
        valueSpan.style.display = "none";

        const tempCancel = document.createElement("button");
        const tempSave = document.createElement("button");
        tempCancel.textContent = "Cancel";
        tempSave.textContent = "Save";
        headerSpan.appendChild(tempCancel);
        headerSpan.appendChild(tempSave);

        tempCancel.addEventListener("click", () => {
          textInput.remove();
          tempCancel.remove();
          tempSave.remove();
          valueSpan.style.display = "inline";
          // restore original four
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editTextBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });

        tempSave.addEventListener("click", () => {
          data = textInput.value;
          valueSpan.textContent = data;
          textInput.remove();
          tempCancel.remove();
          tempSave.remove();
          valueSpan.style.display = "inline";
          // restore original four
          cancelBtn.style.display = "inline-block";
          saveBtn.style.display = "inline-block";
          editTextBtn.style.display = "inline-block";
          addChildBtn.style.display = "inline-block";
        });
      });

      // “Add child” => We are converting a leaf to a node:
      //   if it has a value, we add a new child named "old value" to preserve it,
      //   plus "new child". Then this item’s data becomes an object/array.
      addChildBtn.addEventListener("click", () => {
        const oldValue = data;
        // Convert this item into an object
        const newObj = {
          "new child": "",
          "old value": oldValue,
        };
        // Now we must replace the parent's reference
        if (parent !== null) {
          if (Array.isArray(parent)) {
            // Replace the index of data with newObj
            const index = parent.indexOf(data);
            if (index >= 0) {
              parent[index] = newObj;
            }
          } else {
            parent[key] = newObj;
          }
        } else {
          // If it's root, just set global
          jsonData = newObj;
        }
        reRender();
      });

      // “Cancel” => revert
      cancelBtn.addEventListener("click", () => {
        reRender();
      });

      // “Save” => accept changes, exit edit mode
      saveBtn.addEventListener("click", () => {
        // For a single primitive, there's not much to save beyond the re-render
        reRender();
      });
    });

    // “Delete” => remove from parent
    deleteBtn.addEventListener("click", () => {
      if (parent !== null) {
        if (Array.isArray(parent)) {
          const index = parent.indexOf(data);
          if (index > -1) {
            parent.splice(index, 1);
          }
        } else {
          delete parent[key];
        }
        reRender();
      } else {
        // top-level
        jsonData = {};
        reRender();
      }
    });
  }

  function reRender() {
    // Clear container and re-render
    jsonContainer.innerHTML = "";
    renderJSON(jsonData, jsonContainer);
  }
}

/**
 * Save JSON button: Provide a way to “download” the updated JSON.
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
