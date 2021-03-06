import tinycolor from "tinycolor2";
import {
  colorsWithAlpha,
  alphaEqualityTolerance,
  fallbackColors
} from "./constants";
import { presetThemesContext, bgImages } from "./assets";

const defaultTheme = presetThemesContext("./default.json");

export const themesEqual = (themeA, themeB) => {
  if (!!themeA !== !!themeB) {
    return false;
  }

  const hasImagesA =
    "images" in themeA && "additional_backgrounds" in themeA.images;
  const hasImagesB =
    "images" in themeB && "additional_backgrounds" in themeB.images;
  if (hasImagesA !== hasImagesB) {
    return false;
  }
  if (hasImagesA && hasImagesB) {
    // HACK: We only allow one image at this point, so be lazy:
    if (
      themeA.images.additional_backgrounds[0] !==
      themeB.images.additional_backgrounds[0]
    ) {
      return false;
    }
  }

  const hasCustomImagesA =
    "images" in themeA && "custom_backgrounds" in themeA.images;
  const hasCustomImagesB =
    "images" in themeB && "custom_backgrounds" in themeB.images;
  if (hasCustomImagesA !== hasCustomImagesB) {
    return false;
  }
  if (hasCustomImagesA && hasCustomImagesB) {
    const imagesA = themeA.images.custom_backgrounds;
    const imagesB = themeB.images.custom_backgrounds;
    if (imagesA.length !== imagesB.length) {
      return false;
    }
    for (let idx = 0; idx < imagesA.length; idx++) {
      if (imagesA[idx] !== imagesB[idx]) {
        return false;
      }
    }
  }

  // TODO: Skipping title equality, because user themes don't have titles yet.

  const hasColorsA = "colors" in themeA;
  const hasColorsB = "colors" in themeB;
  if (hasColorsA !== hasColorsB) {
    return false;
  }
  if (!hasColorsA && !hasColorsB) {
    // HACK: Not having colors is invalid, but let's call them equal anyway.
    return true;
  }

  const colorNames = Object.keys(defaultTheme.colors);

  for (let name of colorNames) {
    const inA = name in themeA.colors;
    const inB = name in themeB.colors;
    if (inA !== inB) {
      return false;
    }
    if (!inA && !inB) {
      continue;
    }

    const colorA = themeA.colors[name];
    const colorB = themeB.colors[name];
    for (let channel of ["r", "g", "b"]) {
      if (colorA[channel] !== colorB[channel]) {
        return false;
      }
    }

    const alphaInA = "a" in colorA;
    const alphaInB = "a" in colorB;
    if (alphaInA !== alphaInB) {
      return false;
    }
    if (
      alphaInA &&
      alphaInB &&
      Math.abs(colorA.a - colorB.a) > alphaEqualityTolerance
    ) {
      return false;
    }
  }

  return true;
};

export const makeTinycolor = colorIn => {
  const color = { ...colorIn };
  if ("s" in color) {
    color.s = Math.floor(color.s) / 100.0;
  }
  if ("a" in color) {
    // HACK: normalize alpha value to two decimal places - LOL JS FP WTF
    if (color.a > 1.0) {
      color.a = Math.floor(color.a) / 100.0;
    }
    color.a = Math.ceil(color.a * 100) / 100.0;
  }
  return tinycolor(color);
};

export const colorToCSS = colorIn => makeTinycolor(colorIn).toRgbString();

export const normalizeThemeBackground = background =>
  bgImages.keys().includes(background) ? background : null;

// Utility to ensure normal & consistent colors
export const normalizeThemeColor = (name, data, defaultColor) => {
  const color = makeTinycolor(data || defaultColor).toRgb();
  if (!colorsWithAlpha.includes(name)) {
    delete color.a;
  }
  return color;
};

export const normalizeThemeColors = (colors = {}) => {
  const out = {};
  const { colors: defaultColors } = defaultTheme;
  Object.keys(defaultColors).forEach(name => {
    const matchedColor = colors[name] || colors[fallbackColors[name]];
    const color = normalizeThemeColor(name, matchedColor, defaultColors[name]);
    out[name] = color;
  });
  return out;
};

// Utility to ensure normal properties and values in app theme state
export const normalizeTheme = (data = {}) => {
  const theme = {
    colors: normalizeThemeColors(data.colors, defaultTheme.colors),
    images: {
      additional_backgrounds: []
    },
    title: data.title
  };
  const images = data.images ? data.images : {};

  if (images.custom_backgrounds) {
    if (!Array.isArray(theme.images.custom_backgrounds)) {
      theme.images.custom_backgrounds = [];
    }
    theme.images.custom_backgrounds = images.custom_backgrounds || [];
  }

  if (images.headerURL) {
    const background = normalizeThemeBackground(images.headerURL);
    if (background) {
      theme.images.additional_backgrounds = [background];
    }
  }

  if (images.additional_backgrounds) {
    const background = normalizeThemeBackground(
      images.additional_backgrounds[0]
    );
    if (background) {
      theme.images.additional_backgrounds = [background];
    }
  }

  return theme;
};

export const presetThemes = presetThemesContext
  .keys()
  .map((filename, idx) => ({
    idx,
    filename,
    ...normalizeTheme(presetThemesContext(filename))
  }))
  .sort(({ filename: a }, { filename: b }) => a.localeCompare(b));

// Blank 1x1 PNG from http://png-pixel.com/
const BLANK_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export const convertToBrowserTheme = (theme, bgImages, customBackgrounds) => {
  const newTheme = {
    images: {},
    properties: {},
    colors: {}
  };

  const custom_backgrounds = theme.images.custom_backgrounds || [];
  if (custom_backgrounds.length > 0) {
    const additional_backgrounds = [];
    const additional_backgrounds_alignment = [];
    const additional_backgrounds_tiling = [];

    custom_backgrounds.forEach(({ name, alignment, tiling }) => {
      const background = customBackgrounds[name];
      if (!background || !background.image) {
        return;
      }
      additional_backgrounds.push(background.image);
      additional_backgrounds_alignment.push(alignment || "left top");
      additional_backgrounds_tiling.push(tiling || "no-repeat");
    });

    newTheme.images.additional_backgrounds = additional_backgrounds;
    Object.assign(newTheme.properties, {
      additional_backgrounds_alignment,
      additional_backgrounds_tiling
    });
  } else {
    const background = normalizeThemeBackground(
      theme.images.additional_backgrounds[0]
    );
    if (background) {
      newTheme.images.additional_backgrounds = [bgImages(background)];
      Object.assign(newTheme.properties, {
        additional_backgrounds_alignment: ["top"],
        additional_backgrounds_tiling: ["repeat"]
      });
    }
  }

  // the headerURL is required in < 60,
  // but it creates an ugly text shadow.
  // So only add it for older FFs only.
  // const fxVersion = navigator.userAgent.toLowerCase().split("firefox/")[1];
  // if (fxVersion < 60) {
  newTheme.images.headerURL = BLANK_IMAGE;
  // }

  Object.keys(theme.colors).forEach(key => {
    newTheme.colors[key] = colorToCSS(theme.colors[key]);
  });

  // TODO: we will need to actually create this field in
  // theme manifests as part of #93.
  if (!theme.colors.hasOwnProperty("tab_loading")) {
    newTheme.colors.tab_loading = colorToCSS(theme.colors.tab_line);
  }

  if (!theme.colors.hasOwnProperty("popup")) {
    newTheme.colors.popup = colorToCSS(theme.colors.accentcolor);
  }

  if (!theme.colors.hasOwnProperty("popup_text")) {
    newTheme.colors.popup_text = colorToCSS(theme.colors.toolbar_text);
  }

  return newTheme;
};
