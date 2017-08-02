/**
 * SimpleJPEGExporter
 *
 * A Photoshop CS script that exports one or more images as JPEG files
 * compatible with various online art application platforms.
 *
 * @author Claude Zervas
 * @copyright Copyright 2016 Claude Zervas
 * @license GPL V3
 *
 * Loosely follows the Google JavaScript Style Guide:
 * https://google.github.io/styleguide/javascriptguide.xml
 */

/*
@@@BUILDINFO@@@ SimpleJPEGExporter.jsx 0.1
*/
/*
// BEGIN__HARVEST_EXCEPTION_ZSTRING
<javascriptresource>
<name>$$$/UTLCO/Menu=Simple JPEG Export...</name>
<eventid>46a4a150-963b-11e6-bdf4-0800200c9a66</eventid>
</javascriptresource>
// END__HARVEST_EXCEPTION_ZSTRING
*/

// The target declaration is probably unnecessary...
// This script won't be invoked outside of Photoshop.
/*
#target photoshop
*/

var DEFAULT_JPEG_QUALITY = 75;
//var MIN_JPEG_QUALITY = 10;
var DEFAULT_MAX_IMAGE_SIZE = 1920;
var MAX_UI_PATH_LEN = 60;
var FILE_SUFFIX = '-copy';
// Image size detente step values for size slider control.
var SIZE_STEPS = [100, 240, 480, 600, 720, 800, 1000, 1280, 1600, 1920, 2048];
// JPEG quality detente step values for jpeg quality slider control.
var JPEG_STEPS = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
// Background color selection to MatteType
var JPEG_MATTE = [MatteType.BLACK, MatteType.WHITE, MatteType.BACKGROUND, MatteType.FOREGROUND]

var KEY_EXPORT_FOLDER = app.stringIDToTypeID('exportFolder');
var KEY_JPEG_QUALITY = app.stringIDToTypeID('jpegQuality');
var KEY_MAX_IMAGE_SIZE = app.stringIDToTypeID('maxImageSize');
var KEY_JPEG_MATTE = app.stringIDToTypeID('matteIndex');
var KEY_CLOSE_AFTER_EXPORT = app.stringIDToTypeID('closeAfterExport');
var KEY_SILENT_OVERWRITE = app.stringIDToTypeID('silentOverwrite');
var SETTINGS_KEY = 'utlcoSimpleJPEGExporter';

var EXPORT_RETRY = -1;
var EXPORT_FAILED = -2;
var EXPORT_OK = 1;

/**
 * Initialize properties with defaults and load any
 * previously saved settings.
 *
 * @constructor Constructor.
 */
function SimpleJPEGExporter() {
  this.windowRef = null;

  // JPEG output quality 1-100%
  this.jpegQuality = DEFAULT_JPEG_QUALITY;
  // JPEG matte type index
  this.jpegMatte = 0
  // Maximum exported image height/width
  this.maxImageSize = DEFAULT_MAX_IMAGE_SIZE;
  // Close the original document after export
  this.closeAfterExport = false;
  // Silently overwrite existing file with exported JPEG.
  // The user will still be alerted if the source document has the same path.
  this.silentOverwrite = false;
  // Close the temporary copy after export (can be set to false for debugging)
  this.closeTmpAfterExport = true;
  // The folder where the exported JPEGs will be saved
  this.exportFolder = app.activeDocument.path;

  // Get stored settings/options - these override defaults if present.
  this.getSettings();
};

/**
 * Main entry point for this script.
 */
SimpleJPEGExporter.prototype.run = function() {
  if (app.documents.length === 0) {
    Window.alert('There are no open images to export.');
  } else {
    // Build the UI
    this.buildDialog();
    // Initialize event handlers for the UI widgets
    this.initEventHandlers();
    // Show the dialog
    this.windowRef.show();
  }
};

/**
 * OK, take care of business...
 * Export all open image documents.
 *
 * This is invoked when the user clicks 'OK'...
 *
 * @returns The export status.
 */
SimpleJPEGExporter.prototype.okGo = function() {
  // Save current prefs and settings to restore later
  var originalRulerUnits = preferences.rulerUnits;
  var originalBgColor = app.backgroundColor;
  var originalDisplayDialogs = app.displayDialogs;
  var status = EXPORT_FAILED;

  app.displayDialogs = DialogModes.NO;
  preferences.rulerUnits = Units.PIXELS;

  try {
    status = this.exportAll();
  } finally {
    // Restore prefs and document settings
    preferences.rulerUnits = originalRulerUnits;
    app.backgroundColor = originalBgColor;
    app.displayDialogs = originalDisplayDialogs;
  }

  return status;
};

/**
 *  Export all currently open images.
 *
 *  @return The export status: EXPORT_OK, EXPORT_RETRY, or EXPORT_FAILED.
 */
SimpleJPEGExporter.prototype.exportAll = function() {
  var status = EXPORT_OK;
  var numDocs = app.documents.length;
  // Convert JPEG quality from percent to 0-12
  var jpegQuality = Math.round(12 * (this.jpegQuality / 100.0));
  var jpegMatte = JPEG_MATTE[this.jpegMatte]
  
  // Make a copy of the document list since it's a live collection
  var openDocuments = Array(numDocs);
  for (var i = 0; i < numDocs; i++) {
    openDocuments[i] = app.documents[i];
  }

  for (var i = 0; i < numDocs; i++) {
    var srcDoc = openDocuments[i];
    var srcFilename = srcDoc.name;
    var extindex = srcFilename.lastIndexOf('.');
    var basename = srcFilename.substr(0, extindex) || srcFilename;
//    var extension = srcFilename.substr(extindex, srcFilename.length) || '';
//    extension = extension.toLowerCase();
    var destPath = this.exportFolder.fullName + '/' + basename + '.jpg';
    var jpegFile = File(destPath);

    if (jpegFile.fsName == srcDoc.fullName.fsName) {
      Window.alert('Cannot overwrite the original image file: ' +
                   srcDoc.name + '\n' +
                   'Please choose a different export folder.');
      // Allow the user to choose a different export folder or cancel.
      status = EXPORT_RETRY;
      break;
    }

    if (!this.silentOverwrite && jpegFile.exists) {
      var overwrite = Window.confirm('Overwrite existing output file?\n' +
                                     jpegFile.fsName);
      if (!overwrite) {
        status = EXPORT_RETRY;
        break;
      }
    }

    // Make a temporary copy of the current image document.
    // This seems to only work if the document to be duplicated is made
    // the active document... No idea why.
    app.activeDocument = srcDoc;
    var tmpDoc = srcDoc.duplicate(basename, true);
    try {
      var jpegOptions = this.processJPEG(tmpDoc, this.maxImageSize,
                                         jpegQuality, jpegMatte);
      tmpDoc.saveAs(jpegFile, jpegOptions, true, Extension.LOWERCASE);
    } catch (e) {
      Window.alert('Exporting ' + srcDoc.name + ' failed:\n' + e);
      status = EXPORT_FAILED;
      break;
    } finally {
      if (this.closeTmpAfterExport) {
        tmpDoc.close(SaveOptions.DONOTSAVECHANGES);
      }
    }

    // Close the source image document when done, if required.
    if (status === EXPORT_OK && this.closeAfterExport) {
      srcDoc.close(SaveOptions.PROMPTTOSAVECHANGES);
    }
  }
  return status;
};

/**
 * Process and resize the temporary image document to make it JPEG friendly.
 *
 * @param {Document} doc - The Photoshop source image document.
 * @param {number} maxSize - The maximum height/width of the exported image.
 * @param {number} jpegQuality - The JPEG output quality 10-100%.
 * @param {string} matte - The jpeg MatteType.
 *      Can be null, in which case no letterboxing is performed.
 *
 * @returns {JPEGOptions}
 */
SimpleJPEGExporter.prototype.processJPEG = function(
    doc, maxSize, jpegQuality, jpegMatte
) {
  var resampleMethod = ResampleMethod.BICUBICSHARPER;
  var aspectRatio = doc.width / doc.height;
  var width = maxSize;
  var height = maxSize;
  var scaleFactor = 1.0;

  // Make the image JPEG friendly.
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

  jpegOptions = new JPEGSaveOptions();
  jpegOptions.embedColorProfile = true;
  jpegOptions.formatOptions = FormatOptions.STANDARDBASELINE;
  jpegOptions.matte = jpegMatte;
  jpegOptions.transparency = false
  jpegOptions.quality = jpegQuality;
  return jpegOptions;
};

/**
 * Initialize event handlers for the UI widgets.
 */
SimpleJPEGExporter.prototype.initEventHandlers = function() {
  // TODO: hoist these event handler functions?
  // Cache this scope to make it visible to event handlers.
  var outerThis = this;

  // Handle clicks on the "Choose Export Folder" button.
  this.guiFolderBtn.onClick = function() {
    var folder = outerThis.exportFolder.selectDlg('Choose export folder');
    var folderPath = Folder.decode(folder.fsName);
    outerThis.exportFolder = folder;
    outerThis.guiFolderPath.text = outerThis.truncatePath(folderPath);
    outerThis.guiFolderPath.characters = folderPath.length;
    // For some reason it seems impossible to resize the dialog
    // to fit the new pathname without mangling the layout...
    // outerThis.windowRef.layout.layout(true);
  };

  // Update JPEG quality when the slider is changed.
  this.guiJpgSlider.onChanging = function() {
    var stepIndex = findStepIndex(this.value, JPEG_STEPS);
    var val = JPEG_STEPS[stepIndex];//Math.round(this.value);
    this.value = val;
    outerThis.guiJpgQuality.text = val + '%';
    outerThis.jpegQuality = val;
  };

  // Handle changes to the JPEG quality text box
  this.guiJpgQuality.onChange = function() {
    var val = parseInt(this.text);
    if (isNaN(val)) {
      val = outerThis.jpegQuality;
    }
    val = Math.min(Math.max(val, JPEG_STEPS[0]),
                   JPEG_STEPS[JPEG_STEPS.length - 1]);
    this.text = val + '%';
    // Update the slider position
    outerThis.guiJpgSlider.value = val;
    outerThis.jpegQuality = val;
  };

  // Handle changes to the image size text box
  this.guiMaxSize.onChange = function() {
    var val = parseInt(this.text);
    if (isNaN(val)) {
      // User input some bogus text - revert to previous value.
      val = outerThis.maxImageSize;
    }
    // Limit image size to a reasonable minimum/maximum.
    val = Math.min(Math.max(val, SIZE_STEPS[0]),
                   SIZE_STEPS[SIZE_STEPS.length - 1]);
    this.text = String(val);
    outerThis.guiSizeSlider.value = val;
    outerThis.maxImageSize = val;
  };

  // Update max size when the slider is changed.
  this.guiSizeSlider.onChanging = function() {
    var stepIndex = findStepIndex(this.value, SIZE_STEPS);
    var val = SIZE_STEPS[stepIndex];
    this.value = val;
    outerThis.guiMaxSize.text = String(val);
    outerThis.maxImageSize = val;
  };

  this.guiCloseAfterExportChk.onClick = function() {
    outerThis.closeAfterExport = this.value;
  };

  this.guiSilentOverwriteChk.onClick = function() {
    outerThis.silentOverwrite = this.value;
  };

  this.guiResetBtn.onClick = function() {
    // Settings to default values
    outerThis.jpegQuality = DEFAULT_JPEG_QUALITY;
    outerThis.maxImageSize = DEFAULT_MAX_IMAGE_SIZE;
    // Update UI
    outerThis.guiJpgSlider.value = outerThis.jpegQuality;
    outerThis.guiJpgQuality.text = outerThis.jpegQuality + '%';
    outerThis.guiMaxSize.text = String(outerThis.maxImageSize);
    outerThis.guiSizeSlider.value = outerThis.maxImageSize;
    outerThis.guiMatteList.selection = 0;
  };
  
  this.guiMatteList.onChange = function() {
    outerThis.jpegMatte = outerThis.guiMatteList.selection.index;
  }

  this.guiCancelBtn.onClick = function() {
    outerThis.windowRef.close();
  };

  this.guiOkBtn.onClick = function() {
    var status = EXPORT_FAILED;
    // Export open documents.
    try {
      status = outerThis.okGo();
    } catch (e) {
      Window.alert('Export failed: \n' + e);
    }
    if (status != EXPORT_RETRY) {
      // Save current settings.
      outerThis.putSettings();
      // Close dialog and quit.
      outerThis.windowRef.close();
    }
  };
};

/**
 * Build the dialog UI and controls.
 *
 * @returns {Window} The dialog Window object
 */
SimpleJPEGExporter.prototype.buildDialog = function() {
  var dlgResource =
    'dialog { text:"Simple JPEG Exporter",' +
      'folderGrp: Group {' +
        'alignment: "left",' +
        'orientation: "column",' +
        'folderPath: StaticText {' +
          'alignment:"left", characters: 80, minimumSize: [450, 0]},' +
        'folderBtn: Button { alignment:"left", text:"Choose Export Folder"},' +
      '}' +
      'settingsPnl: Panel {' +
        'text: "Image Settings",' +
        'alignment: "left",' +
        'orientation: "column",' +
        'jpgGrp: Group { ' +
          'alignment:"right",' +
          'labelTxt: StaticText { text: "JPEG quality:" },' +
          'jpqQGrp: Group {' +
            'alignment: "left",' +
            'size: [300, 30],' +
            'jpgQuality: EditText { text: "", characters: 4 },' +
            'jpgSlider: Slider { size: [150, 30] },' +
          '}' +
        '}' +
        'sizeGrp: Group {' +
          'alignment:"right",' +
          'labelTxt: StaticText { text: "Max image size:" },' +
          'sizeSubGrp: Group {' +
            'alignment: "left",' +
            'size: [300, 30],' +
            'maxSize: EditText { text: "1920", characters: 4 },' +
            'sizeSlider: Slider { size: [150, 30] },' +
          '}' +
        '}' +
        'matteGrp: Group {' +
        'alignment:"right",' +
        'labelTxt: StaticText { text: "Matte color:" },' +
        'matteSubGrp: Group {' +
          'alignment: "left",' +
          'size: [300, 30],' +
          'matteList: DropDownList { properties: { items: ["Black", "White", "Background", "Foreground"] } },' +
        '}' +
      '}' +
        'resetGrp: Group {' +
          'alignment:"right",' +
          'labelTxt: StaticText { text: "" },' +
          'resetBtn: Button { text: "Default Values" },' +
//          'resetSubGrp: Group {' +
//            'alignment: "left",' +
//            'size: [300, 30],' +
//            'resetBtn: Button { text: "Default Values" },' +
//          '}' +
        '}' +
      '}' +
      'closeGrp: Group {' +
        'alignment:"left",' +
        'labelTxt: StaticText { text: "Close images after export" },' +
        'closeAfterExportChk: Checkbox { value: false },' +
      '}' +
      'overwrtGrp: Group {' +
        'alignment:"left",' +
        'labelTxt: StaticText {' +
          'text: "Overwrite image files in export folder" },' +
        'silentOverwriteChk: Checkbox { value: false },' +
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
  this.guiSizeSlider = win.settingsPnl.sizeGrp.sizeSubGrp.sizeSlider;
  this.guiMatteList = win.settingsPnl.matteGrp.matteSubGrp.matteList;
  this.guiResetBtn = win.settingsPnl.resetGrp.resetBtn;
//  this.guiResetBtn = win.settingsPnl.resetGrp.resetSubGrp.resetBtn;
  this.guiCloseAfterExportChk = win.closeGrp.closeAfterExportChk;
  this.guiSilentOverwriteChk = win.overwrtGrp.silentOverwriteChk;
  this.guiCancelBtn = win.okGrp.cancelBtn;
  this.guiOkBtn = win.okGrp.okBtn;

  // Initialize widget values
  var folderPath = Folder.decode(this.exportFolder.fsName);
  this.guiFolderPath.text = this.truncatePath(folderPath);
  this.guiJpgQuality.text = this.jpegQuality + '%';
  this.guiJpgSlider.minvalue = JPEG_STEPS[0];
  this.guiJpgSlider.maxvalue = JPEG_STEPS[JPEG_STEPS.length - 1];
  this.guiJpgSlider.value = this.jpegQuality;
  this.guiMaxSize.text = String(this.maxImageSize);
  this.guiSizeSlider.minvalue = SIZE_STEPS[0];
  this.guiSizeSlider.maxvalue = SIZE_STEPS[SIZE_STEPS.length - 1];
  this.guiSizeSlider.value = this.maxImageSize;
  this.guiMatteList.selection = this.jpegMatte;
  this.guiCloseAfterExportChk.value = this.closeAfterExport;
  this.guiSilentOverwriteChk.value = this.silentOverwrite;

  this.windowRef = win;
  return this.windowRef;
};

/**
 * Truncate unreasonably long path strings to make them fit in the dialog.
 */
SimpleJPEGExporter.prototype.truncatePath = function(path) {
  var pathLen = path.length;
  var truncatedPath = path;
  if (pathLen > MAX_UI_PATH_LEN) {
    truncatedPath = '.....' + path.substring(pathLen - MAX_UI_PATH_LEN);
  }
  return truncatedPath;
};

/**
 * Fetch persistent dialog settings.
 */
SimpleJPEGExporter.prototype.getSettings = function() {
  try {
    var desc = app.getCustomOptions(SETTINGS_KEY);
    this.exportFolder = Folder(desc.getString(KEY_EXPORT_FOLDER));
    this.jpegQuality = desc.getInteger(KEY_JPEG_QUALITY);
    this.maxImageSize = desc.getInteger(KEY_MAX_IMAGE_SIZE);
    this.closeAfterExport = desc.getBoolean(KEY_CLOSE_AFTER_EXPORT);
    this.silentOverwrite = desc.getBoolean(KEY_SILENT_OVERWRITE);
    this.jpegMatte = desc.getInteger(KEY_JPEG_MATTE)
    // Add future options at the end to avoid skipping existing ones
    // if an exception is thrown.
  } catch (e) {
    // An exception will be thrown if settings haven't
    // been saved. Just ignore it. This only happens the first time
    // the script is used or if a new setting is added.
    //Window.alert('Error fetching settings:\n' + e);
  }
};

/**
 *  Persist this dialog's current settings.
 */
SimpleJPEGExporter.prototype.putSettings = function() {
  var desc = new ActionDescriptor();
  desc.putString(KEY_EXPORT_FOLDER, this.exportFolder.fullName);
  desc.putInteger(KEY_JPEG_QUALITY, this.jpegQuality);
  desc.putInteger(KEY_MAX_IMAGE_SIZE, this.maxImageSize);
  desc.putInteger(KEY_JPEG_MATTE, this.jpegMatte);
  desc.putBoolean(KEY_CLOSE_AFTER_EXPORT, this.closeAfterExport);
  desc.putBoolean(KEY_SILENT_OVERWRITE, this.silentOverwrite);
  try {
    app.putCustomOptions(SETTINGS_KEY, desc);
  } catch (e) {
    // This shouldn't happen...
    Window.alert('Error saving settings:\n' + e);
  }
};


/**
 * Find a step array index for the given value.
 *
 * @param {Number} val
 * @param {Array} steps
 *
 * @returns {Number} An index into the step array.
 */
function findStepIndex(val, steps) {
  var stepIndex = 0;
  var lastInterval = Infinity;
  // Do a dumb linear search of the step interval array...
  for (var i = 0; i < steps.length; i++) {
    var stepVal = steps[i];
    var interval = Math.abs(stepVal - val);
    if (interval < lastInterval) {
      stepIndex = i;
      lastInterval = interval;
    }
  }
  return stepIndex;
}


/**
 * Launch the script.
 *
 * Construct an anonymous instance and run it
 * as long as we are not unit-testing this snippet.
 */
if (typeof(SimpleJPEGExporter_unitTest) == "undefined") {
  try {
    new SimpleJPEGExporter().run();
  } catch (e) {
    // This shouldn't happen but if scripts throw an unhandled
    // exception it seems to bork Photoshop's javascript engine...
    Window.alert('Script failed:\n' + e);
  }
}





