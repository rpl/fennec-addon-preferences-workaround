/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cu } = require('chrome');
const { on } = require('sdk/system/events');
const { preferencesBranch } = require('sdk/self');
const { localizeInlineOptions } = require('sdk/l10n/prefs');
const { AddonManager } = Cu.import("resource://gre/modules/AddonManager.jsm");
const { defer } = require("sdk/core/promise");

// Import the original methods from the native-options that don't need to be fixed.
const { validate, setDefaults, injectOptions } = require("sdk/preferences/native-options");

// Tweaks on the original `require("sdk/preferences/native-options").enable` method
// to fix the issues on Firefox for Android, by injecting the elements in the right place.
function enable({ preferences, id }) {
  let enabled = defer();

  validate(preferences);

  setDefaults(preferences, preferencesBranch);

  // allow the use of custom options.XL
  AddonManager.getAddonByID(id, (addon) => {
    on('addon-options-displayed', onAddonOptionsDisplayed, true);
    enabled.resolve({ id: id });
  });

  function onAddonOptionsDisplayed({ subject: doc, data }) {
    let optionsBox = doc.querySelector('.options-box');

    if (!optionsBox) {
      // if the options elements are not found the workaround will
      // not work.
      return;
    }

    if (data === id) {
      optionsBox.style.display = "block";

      let header = doc.querySelector(".options-header").cloneNode(true);
      header.style.display = "block";
      optionsBox.appendChild(header);

      let box = doc.createElement("vbox");
      optionsBox.appendChild(box);

      injectOptions({
        preferences: preferences,
        preferencesBranch: preferencesBranch,
        document: doc,
        parent: box,
        id: id
      });
      localizeInlineOptions(doc);
    }
  }

  return enabled.promise;
}

// Check if the workaround is needed:
// native-options does stuff directly with preferences key from package.json
// that needs to be hot fixed for Firefox for Android 44 and 45
const { id } = require('sdk/self');
const { metadata } = require('@loader/options');
const { preferences } = metadata;

const xulApp = require("sdk/system/xul-app");
const isFennec = xulApp.is("Fennec");
const isVersionInRange = xulApp.versionInRange(xulApp.platformVersion, "44.0", "*");

// Apply the workaround on Firefox for Android >= 44.0
if (isFennec && isVersionInRange && preferences && preferences.length > 0) {
  try {
    enable({ preferences: preferences, id: id }).
      catch(console.exception);
  }
  catch (error) {
    console.exception(error);
  }
}
