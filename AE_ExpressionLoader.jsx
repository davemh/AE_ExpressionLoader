(function (thisObj) {
  var scriptName = "AE_ExpressionLoader";
  var settingKey = "expressionFolder";
  var folderPath = "";

  function loadFolderPath() {
    if (app.settings.haveSetting(scriptName, settingKey)) {
      folderPath = app.settings.getSetting(scriptName, settingKey);
    }
  }

  function saveFolderPath(path) {
    app.settings.saveSetting(scriptName, settingKey, path);
  }

  function expressionPanel(thisObj) {
    var win = thisObj instanceof Panel ? thisObj : new Window("palette", "Expression Loader", undefined);
    win.spacing = 6;

    var mainGroup = win.add("group");
    mainGroup.orientation = "column";
    mainGroup.margins = [10, 10, 10, 10];

    var folderGroup = mainGroup.add("group");
    folderGroup.orientation = "row";
    folderGroup.add("statictext", undefined, "Folder:");
    var folderText = folderGroup.add("edittext", [0, 0, 300, 20], folderPath);
    var browseButton = folderGroup.add("button", undefined, "Browse");

    var listGroup = mainGroup.add("group");
    var listbox = listGroup.add("listbox", [0, 0, 300, 150]);
    var optionGroup = mainGroup.add("group");
    optionGroup.orientation = "row";
    optionGroup.add("statictext", undefined, "Property:");

    var positionCheckbox = optionGroup.add("radiobutton", undefined, "Position");
    var scaleCheckbox = optionGroup.add("radiobutton", undefined, "Scale");
    var rotationCheckbox = optionGroup.add("radiobutton", undefined, "Rotation");
    var selectedCheckbox = optionGroup.add("radiobutton", undefined, "Selected");
    positionCheckbox.value = true;

    var refreshButton = mainGroup.add("button", undefined, "Refresh List");

    var varsPanel = mainGroup.add("panel", undefined, "Custom Variables");
    varsPanel.orientation = "column";
    varsPanel.alignChildren = ["left", "fill"];

    var applyButton = mainGroup.add("button", undefined, "Apply Expression");

    function updateFileList() {
      listbox.removeAll();
      if (folderText.text != "") {
        var folder = new Folder(folderText.text);
        if (folder.exists) {
          var files = folder.getFiles("*.txt");
          for (var i = 0; i < files.length; i++) {
            var fileName = files[i].name.replace(/%20/g, " ");
            listbox.add("item", fileName);
          }
        }
      }
    }

    function updateVariablesPanel(expression) {
      while (varsPanel.children.length > 0) {
        varsPanel.remove(varsPanel.children[0]);
      }

      var variableRegex = /{{(.*?)}}/g;
      var match;
      var variablesFound = false;

      while ((match = variableRegex.exec(expression)) !== null) {
        variablesFound = true;
        var variableName = match[1];

        var defaultValueMatch = match[1].match(/(.*?)\s*=\s*(.*)/);
        var defaultValue = defaultValueMatch ? defaultValueMatch[2] : "";

        var group = varsPanel.add("group");
        group.orientation = "row";
        group.add("statictext", undefined, variableName + ":");
        var input = group.add("edittext", [0, 0, 200, 20], defaultValue);
        input.name = variableName;
      }

      if (!variablesFound) {
        varsPanel.add("statictext", undefined, "No variables found.");
      }

      varsPanel.layout.layout(true);
      win.layout.layout(true);
    }

    browseButton.onClick = function () {
      var folder = Folder.selectDialog("Select the folder with expressions");
      if (folder) {
        folderText.text = folder.fsName;
        saveFolderPath(folder.fsName);
        updateFileList();
      }
    };

    refreshButton.onClick = function () {
      updateFileList();
    };

    listbox.onChange = function () {
      if (listbox.selection) {
        var fileName = listbox.selection.text;

        var file = new File(folderText.text + "/" + fileName.replace(/ /g, "%20"));
        if (file.exists) {
          file.open("r");
          var expression = file.read();
          file.close();
          updateVariablesPanel(expression);
        }
      }
    };

    applyButton.onClick = function () {
      if (listbox.selection) {
        var fileName = listbox.selection.text;

        var file = new File(folderText.text + "/" + fileName.replace(/ /g, "%20"));
        if (file.exists) {
          file.open("r");
          var expression = file.read();
          file.close();
          var variables = {};
          for (var i = 0; i < varsPanel.children.length; i++) {
            var group = varsPanel.children[i];
            if (group.children.length > 1) {
              var input = group.children[1];
              variables[input.name] = input.text;
            }
          }
          var finalExpression = replaceVariables(expression, variables);
          applyExpression(
            finalExpression,
            positionCheckbox.value,
            scaleCheckbox.value,
            rotationCheckbox.value,
            selectedCheckbox.value
          );
        } else {
          alert("The selected file does not exist.");
        }
      } else {
        alert("Select an expression from the list.");
      }
    };

    updateFileList();
    win.layout.layout(true);
    win.onResizing = win.onResize = function () {
      this.layout.resize();
    };
    if (win instanceof Window) {
      win.center();
      win.show();
    } else {
      win.layout.layout(true);
    }
  }

  function applyExpression(expression, isPosition, isScale, isRotation, isSelected) {
    if (isPosition) {
      applyExpressionToSelectedLayers(expression, "ADBE Position");
    } else if (isScale) {
      applyExpressionToSelectedLayers(expression, "ADBE Scale");
    } else if (isRotation) {
      applyExpressionToSelectedLayers(expression, "ADBE Rotate Z");
    } else if (isSelected) {
      var selectedProperties = app.project.activeItem.selectedProperties;
      if (selectedProperties.length > 0) {
        for (var i = 0; i < selectedProperties.length; i++) {
          selectedProperties[i].expression = expression;
        }
      } else {
        alert("Select a property to apply the expression.");
      }
    }
  }

  function applyExpressionToSelectedLayers(expression, propertyName) {
    var activeComp = app.project.activeItem;
    if (activeComp && activeComp instanceof CompItem) {
      var selectedLayers = activeComp.selectedLayers;
      if (selectedLayers.length > 0) {
        app.beginUndoGroup("Apply Expression");

        for (var i = 0; i < selectedLayers.length; i++) {
          var layer = selectedLayers[i];
          try {
            var prop = layer.property("ADBE Transform Group").property(propertyName);
            if (prop) {
              prop.expression = expression;
            } else {
              alert("The property " + propertyName + " was not found on the layer " + layer.name);
            }
          } catch (error) {
            alert("Error applying the expression: " + error.message);
          }
        }

        app.endUndoGroup();
      } else {
        alert("Please select at least one layer.");
      }
    } else {
      alert("Please select an active composition.");
    }
  }

  function replaceVariables(expression, variables) {
    for (var key in variables) {
      var regex = new RegExp("{{" + key + "}}", "g");
      expression = expression.replace(regex, variables[key]);
    }
    return expression;
  }

  loadFolderPath();
  expressionPanel(thisObj);
})(this);
