﻿/**
 * SimpleJPEGExporter
 *
 * A Photoshop script that exports one or more images as JPEG files
 * compatible with various online art application platforms.
 *
 * @author Claude Zervas
 * @copyright Claude Zervas 2016
 * @license GPL V3
 *
 */

// This is unnecessary since it needs to be invoked with images already opened
// in Photoshop...
//#target photoshop

const var DEFAULT_JPEG_QUALITY = 75;
const var MIN_JPEG_QUALITY = 10;
const var DEFAULT_MAX_IMAGE_SIZE = 1920;
const var MAX_UI_PATH_LEN = 60;
const var KEY_EXPORT_FOLDER = app.stringIDToTypeID('exportFolder');
const var KEY_JPEG_QUALITY = app.stringIDToTypeID('jpegQuality');
const var KEY_MAX_IMAGE_SIZE = app.stringIDToTypeID('maxImageSize');
const var KEY_CLOSE_AFTER_EXPORT = app.stringIDToTypeID('closeAfterExport');
const var KEY_SILENT_OVERWRITE = app.stringIDToTypeID('silentOverwrite');
const var SETTINGS_KEY = 'utlcoSimpleJPEGExporter';

const var EXPORT_RETRY = -1;
const var EXPORT_FAILED = -2;
const var EXPORT_OK = 1;

/**
 * @constructor Constructor.
 */
function SimpleJPEGExporter() {
  this.windowRef = null;
  // Initialize settings/options with default values.
  this.setDefaultOptions();
  // Get stored options - these override defaults if present.
  this.getOptions();
}

/**
 *  Set options to default values.
 */
SimpleJPEGExporter.prototype.setDefaultOptions = function() {
  // JPEG output quality 1-100%
  this.jpegQuality = DEFAULT_JPEG_QUALITY;
  // Maximum exported image height/width
  this.maxImageSize = DEFAULT_MAX_IMAGE_SIZE;
  // Close the original document after export
  this.closeAfterExport = false;
  // Silently overwrite existing file with exported JPEG.
  // The user will still be alerted if the source document has the same path.
  this.silentOverwrite = true;
  // Close the temporary copy after export (can be set to false for debugging)
  this.closeTmpAfterExport = true;
};

/**
 *  Fetch this dialog's previous option values.
 */
SimpleJPEGExporter.prototype.getOptions = function() {
  try {
    var desc = app.getCustomOptions(SETTINGS_KEY);
    this.exportFolder = Folder(desc.getString(KEY_EXPORT_FOLDER));
    if (desc.hasKey(KEY_JPEG_QUALITY))
      this.jpegQuality = desc.getInteger(KEY_JPEG_QUALITY);
    if (desc.hasKey(KEY_MAX_IMAGE_SIZE))
      this.maxImageSize = desc.getInteger(KEY_MAX_IMAGE_SIZE);
    if (desc.hasKey(KEY_CLOSE_AFTER_EXPORT))
      this.closeAfterExport = desc.getBoolean(KEY_CLOSE_AFTER_EXPORT);
    if (desc.hasKey(KEY_SILENT_OVERWRITE))
      this.silentOverwrite = desc.getBoolean(KEY_SILENT_OVERWRITE);
  } catch (e) {
    // ignore - will use defaults...
    this.exportFolder = app.activeDocument.path;
    this.setDefaultOptions();
  }
};

/**
 *  Persist this dialog's current option values.
 */
SimpleJPEGExporter.prototype.putOptions = function() {
  var desc = new ActionDescriptor();
  desc.putString(KEY_EXPORT_FOLDER, this.exportFolder.fullName);
  desc.putInteger(KEY_JPEG_QUALITY, this.jpegQuality);
  desc.putInteger(KEY_MAX_IMAGE_SIZE, this.maxImageSize);
  desc.putBoolean(KEY_CLOSE_AFTER_EXPORT, this.closeAfterExport);
  desc.putBoolean(KEY_SILENT_OVERWRITE, this.silentOverwrite);
  app.putCustomOptions(SETTINGS_KEY, desc);
//  Window.alert('Saved settings.');
};

/**
 *  Reset this dialog's current options to default values.
 */
SimpleJPEGExporter.prototype.resetOptions = function() {
  try {
    this.setDefaultOptions();
    app.eraseCustomOptions(SETTINGS_KEY);
  } catch (e) {
    ;// ignore...
  }
};

/**
 * OK, take care of business...
 */
SimpleJPEGExporter.prototype.doit = function() {
  // Save current prefs and settings to restore later
  var originalRulerUnits = preferences.rulerUnits;
  var originalBgColor = app.backgroundColor;
  var originalActiveDoc = app.activeDocument;
  var originalDisplayDialogs = app.displayDialogs;

  var status = EXPORT_FAILED;
  try {
    status = this.exportAll();
  } catch (e) {
    // Exceptions should have been caught already but
    // this a safety to catch bug-related exceptions.
    Window.alert('Script failed:\n' + e);
  }

  // Restore prefs and document settings
  preferences.rulerUnits = originalRulerUnits;
  app.activeDocument = originalActiveDoc;
  app.backgroundColor = originalBgColor;
  app.displayDialogs = originalDisplayDialogs;

  return status;
};

/**
 *  Export all currently open images.
 *  @return True if the export succeeded.
 */
SimpleJPEGExporter.prototype.exportAll = function() {
  var status = EXPORT_OK;

  app.displayDialogs = DialogModes.NO;
  preferences.rulerUnits = Units.PIXELS;

  var jpegQuality = Math.round(12 * (this.jpegQuality / 100.0));
  var numDocs = app.documents.length;
  for (var i = 0; i < numDocs; i++) {
    var srcDoc = app.documents[i];
    app.activeDocument = srcDoc;

    var destPath = this.exportFolder.fullName + '/' + srcDoc.name;
    var jpegFile = File(destPath);
    if (jpegFile.fsName == srcDoc.fullName.fsName) {
      Window.alert('Cannot overwrite the original image file: ' +
                   srcDoc.name + '\n' +
                   'Please choose a different export folder.');
      status = EXPORT_RETRY;
      break;
    }

    // Make a temporary copy of the current active document.
    var tmpDoc = srcDoc.duplicate('untitled', true);
//    Window.alert('src: ' + srcDoc.fullName.fsName + '\ndst: ' + jpegFile.fsName);
    try {
      this.exportJPEG(srcDoc, tmpDoc, destPath,
                      this.maxImageSize, jpegQuality, null);
    } catch (e) {
      Window.alert('Exporting ' + srcDoc.name + ' failed:\n' + e);
      status = EXPORT_FAILED;
      break;
    }

    if (this.closeTmpAfterExport) {
      try {
        tmpDoc.close(SaveOptions.DONOTSAVECHANGES);
      } catch (e) {
        Window.alert('Error closing temporary document: \n' + e);
      }
    }
  }
  if (status == EXPORT_OK && this.closeAfterExport) {
    // Close all open documents.
    while (app.documents.length > 0)  {
      app.documents[0].close(SaveOptions.PROMPTTOSAVECHANGES);
    }
  }
  return status;
};

/**
 * Export the temporary image document as a JPEG file.
 */
SimpleJPEGExporter.prototype.exportJPEG = function(
    srcDoc, tmpDoc, destPath, maxSize, jpegQuality, bgColor
) {
  jpegOptions = this.processJPEG(tmpDoc, maxSize, jpegQuality, bgColor);
  jpegFile = File(destPath);
  // If the source and destination paths are the same then confirm overwrite.
  var saveit = true;
  if (saveit) {
    try {
      tmpDoc.saveAs(jpegFile, jpegOptions, true, Extension.LOWERCASE);
    } catch (e) {
      Window.alert('Can\'t export file:\n' + File.decode(jpegFile.fsName));
    }
  }
};

/**
 * Process and resize the temporary image document to make it JPEG friendly.
 */
SimpleJPEGExporter.prototype.processJPEG = function(
    doc, maxSize, jpegQuality, bgColor
) {
  var resampleMethod = ResampleMethod.BICUBICSHARPER;
  var aspectRatio = doc.width / doc.height;
  var width = maxSize;
  var height = maxSize;
  var scaleFactor = 1.0;

  // Make the image JPEG friendly.
  doc.flatten();
  doc.changeMode(ChangeMode.RGB);
  doc.convertProfile("sRGB IEC61966-2.1", Intent.PERCEPTUAL, true, false);
  doc.bitsPerChannel = BitsPerChannelType.EIGHT;

  // Resize image while retaining aspect ratio
  if (aspectRatio < 1.0) {
    scaleFactor = maxSize / doc.height;
    width = doc.width * scaleFactor;
  } else {
    scaleFactor = maxSize / doc.width;
    height = doc.height * scaleFactor;
  }
  if (scaleFactor > 1.0) {
    // Use smooth interpolation for enlarging
    resampleMethod = ResampleMethod.BICUBICSMOOTHER;
  }
  doc.resizeImage(width, height, 72, resampleMethod);
  // If a background color is specified then resize
  // the canvas to maxSize square and letterbox
  // the image with the specified background color.
  if (bgColor) {
    rgb = new RGBColor();
    rgb.hexValue = bgColor;
    solidcolor = new SolidColor();
    solidcolor.rgb = rgb;
    app.backgroundColor = solidcolor;
    doc.resizeCanvas(maxSize, maxSize);
  }

  jpegOptions = new JPEGSaveOptions();
  jpegOptions.embedColorProfile = true;
  jpegOptions.formatOptions = FormatOptions.STANDARDBASELINE;
  jpegOptions.matte = MatteType.NONE;
  jpegOptions.quality = jpegQuality;
  return jpegOptions;
};

/**
 * Build the dialog UI and controls.
 */
SimpleJPEGExporter.prototype.buildDialog = function() {
  var dlgResource =
    'dialog { text:"Resize and Export JPEGs 4",' +
      'folderGrp: Group {' +
        'alignment: "left",' +
        'orientation: "column",' +
        'folderPath: StaticText { alignment:"left", text:"", characters: 120 },' +
        'folderBtn: Button { alignment:"left", text:"Choose Export Folder"},' +
      '}' +
      'settingsPnl: Panel {' +
        'text: "Settings",' +
        'alignment: "left",' +
        'orientation: "column",' +
        'jpgGrp: Group { ' +
          'alignment:"right",' +
          'labelTxt: StaticText { text: "JPEG quality:" },' +
          'jpqQGrp: Group {' +
            'alignment: "left",' +
            'size: [300, 30],' +
            'jpgQuality: EditText { text: "", characters: 4 },' +
            'jpgSlider: Slider { minvalue: 10, maxvalue: 100, value: 75 },' +
          '}' +
        '}' +
        'sizeGrp: Group {' +
          'alignment:"right",' +
          'labelTxt: StaticText { text: "Max image size:" },' +
          'sizeSubGrp: Group {' +
            'alignment: "left",' +
            'size: [300, 30],' +
            'maxSize: EditText { text: "1920", characters: 4 },' +
          '}' +
        '}' +
        'closeGrp: Group {' +
          'alignment:"right",' +
          'labelTxt: StaticText { text: "Close images after export:" },' +
          'closeSubGrp: Group {' +
            'alignment: "left",' +
            'size: [300, 30],' +
            'closeAfterExportChk: Checkbox { value: false },' +
        '}' +
      '}' +
        'resetGrp: Group {' +
          'alignment:"right",' +
          'labelTxt: StaticText { text: "" },' +
          'resetBtn: Button { text: "Default Values" },' +
        '}' +
      '}' +
      'okGrp: Group {' +
        'alignment: "right",' +
        'cancelBtn: Button {text: "Cancel"},' +
        'okBtn: Button {text: "OK"},' +
      '}' +
    '}';
  win = new Window(dlgResource);

  // Create shortcuts to relevant GUI widgets.
  this.guiFolderBtn = win.folderGrp.folderBtn;
  this.guiFolderPath = win.folderGrp.folderPath;
  this.guiJpgQuality = win.settingsPnl.jpgGrp.jpqQGrp.jpgQuality;
  this.guiJpgSlider = win.settingsPnl.jpgGrp.jpqQGrp.jpgSlider;
  this.guiMaxSize = win.settingsPnl.sizeGrp.sizeSubGrp.maxSize;
  this.guiCloseAfterExportChk = win.settingsPnl.closeGrp.closeSubGrp.closeAfterExportChk;
  this.guiResetBtn = win.settingsPnl.resetGrp.resetBtn;
  this.guiCancelBtn = win.okGrp.cancelBtn;
  this.guiOkBtn = win.okGrp.okBtn;

  // Initialize widget values
  var folderPath = Folder.decode(this.exportFolder.fsName);
  this.guiFolderPath.text = folderPath;// this.truncatePath(folderPath);
  // The characters property is somehow ignored so...
  this.guiFolderPath.minimumSize = [400, 0];
  this.guiJpgQuality.text = this.jpegQuality + '%';
  this.guiJpgSlider.value = this.jpegQuality;
  this.guiMaxSize.text = String(this.maxImageSize);
  this.guiCloseAfterExportChk.value = this.closeAfterExport;

  this.windowRef = win;
  return this.windowRef;
};

/**
 * Truncate unreasonably long path strings to make them fit in the dialog.
 */
SimpleJPEGExporter.prototype.truncatePath = function(path) {
  // TODO: implement this
  return path;
};

SimpleJPEGExporter.prototype.initEventHandlers = function() {
  // Cache this scope to make it visible to event handlers.
  var outerThis = this;

  this.guiFolderBtn.onClick = function() {
    var folder = outerThis.exportFolder.selectDlg('Choose export folder');
    var folderPath = Folder.decode(folder.fsName);
    outerThis.exportFolder = folder;
    outerThis.guiFolderPath.text = folderPath; //this.truncatePath(folderPath);
    outerThis.guiFolderPath.characters = folderPath.length;
//    outerThis.guiFolderPath.preferredSize = [-1, -1];
//    outerThis.windowRef.folderGrp.layout.layout(true);
//    outerThis.windowRef.folderGrp.layout.resize();
//    outerThis.windowRef.layout.layout();
  };

  this.guiJpgSlider.onChanging = function() {
    var val = Math.round(this.value);
    outerThis.guiJpgQuality.text = val + '%';
    outerThis.jpegQuality = val;
  };

  this.guiJpgQuality.onChange = function() {
    var val = parseInt(this.text);
    if (isNaN(val)) {
      val = outerThis.jpegQuality;
    }
    val = Math.max(Math.min(100, val), MIN_JPEG_QUALITY);
    this.text = val + '%';
    outerThis.guiJpgSlider.value = val;
    outerThis.jpegQuality = val;
  };

  this.guiMaxSize.onChange = function() {
    var val = parseInt(this.text);
    if (isNaN(val)) {
      val = outerThis.maxImageSize;
    }
    val = Math.max(val, 1);
    this.text = String(val);
    outerThis.maxImageSize = val;
  };

  this.guiCloseAfterExportChk.onClick = function() {
    outerThis.closeAfterExport = this.value;
  };

  this.guiResetBtn.onClick = function() {
    outerThis.setDefaultOptions();
    outerThis.guiJpgSlider.value = outerThis.jpegQuality;
    outerThis.guiJpgQuality.text = outerThis.jpegQuality + '%';
    outerThis.guiMaxSize.text = String(outerThis.maxImageSize);
  };

  this.guiCancelBtn.onClick = function() {
    outerThis.windowRef.close();
  };

  this.guiOkBtn.onClick = function() {
    // Export open documents.
    var status = outerThis.doit();
    if (status != EXPORT_RETRY) {
      // Save current settings.
      outerThis.putOptions();
      // Close dialog and quit.
      outerThis.windowRef.close();
    }
  };
};

/**
 *
 */
SimpleJPEGExporter.prototype.run = function() {
  if (app.documents.length === 0) {
    Window.alert('There are no open images to export.');
  } else {
    // Build the UI
    this.buildDialog();
    // Initialize UI control event handlers
    this.initEventHandlers();
    // Show the dialog
    this.windowRef.show();
  }
};

/**
 * "main program": construct an anonymous instance and run it
 * as long as we are not unit-testing this snippet.
 */
if (typeof(SimpleJPEGExporter_unitTest) == "undefined") {
  new SimpleJPEGExporter().run();
}




