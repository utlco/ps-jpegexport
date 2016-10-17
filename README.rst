====================
Simple JPEG Exporter
====================

This is a Photoshop CC script for exporting a JPEG from one
or more open images. The script hasn't been tested with earlier
versions of Photoshop but it should be compatible.

It is intended to be used by artists to create JPEGs that are compatible with
various online application platforms such as
`callforentry.org <http://callforentry.org>`.

Most of these application platforms require images to be 1920 pixels on the
longest side and output as JPEG files. This script will automatically resize
the image so that the longest side (either width or height)
is equal to the specified maximum size.

The image will be flattened, color space set to RGB,
color profile converted to sRGB, channels set to 8 bit,
and then resized before being saved as a JPEG file.

If the image is scaled up then *Bicubic Smooth* interpolation is used,
otherwise *Bicubic Sharper* is used if size is reduced.

Installation
------------

1. `Download <https://github.com/utlco/ps-jpegexport/archive/master.zip>`_
   the latest version

2. Unzip/extract the downloaded archive file (ps-jpegexport-master.zip)

3. Copy or move the script file
   **ps-jpegexport-master/SimpleJPEGExport.jsx**
   to the Photoshop scripts folder

4. Restart Photoshop

Alternatively you can start the script in Photoshop from the menu via
File->Scripts->Browse... and then navigate to wherever you downloaded
the script. This is a good way to try it out before installing it into
the scripts folder.

.. _location:

Photoshop script folder location
--------------------------------

* MacOS, Linux:

   `/Applications/Adobe Photoshop CC 2015.5/Presets/Scripts`

   With recent Photoshop versions this folder is protected
   so you will probably be prompted to enter your password to complete
   the copy or move.

* Windows:

   `C:\\Users\\YourUserName\\.AppData\\Roaming\\Adobe\\Photoshop\\...\\Scripts`

