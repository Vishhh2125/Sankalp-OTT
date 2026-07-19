const { withAppBuildGradle } = require('@expo/config-plugins');

function withAndroidStrategies(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    
    // Ensure missingDimensionStrategy for react-native-capture-protection is added
    if (!contents.includes('react-native-capture-protection')) {
      const anchor = 'defaultConfig {';
      const index = contents.indexOf(anchor);
      if (index !== -1) {
        const insertIndex = index + anchor.length;
        contents = 
          contents.slice(0, insertIndex) + 
          '\n        missingDimensionStrategy "react-native-capture-protection", "base"' + 
          contents.slice(insertIndex);
      } else {
        // Fallback: append to the end of the file
        contents += `\n
android {
    defaultConfig {
        missingDimensionStrategy "react-native-capture-protection", "base"
    }
}
`;
      }
      config.modResults.contents = contents;
    }
    
    return config;
  });
}

module.exports = withAndroidStrategies;
