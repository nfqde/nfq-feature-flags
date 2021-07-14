
# @nfq/feature-flags

# Table of Contents
- [Description](#description)
- [Installation](#installation)
- [Usage](#usage)
- [Contributions](#contributions)
- [Licence](#licence)
- [Questions](#questions)

## Description: [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
This is an node module that aims for simple configuration and usage of feature flags. It is build for especially build time feature flags to enable treeshaking of unshipped features depending on the environment.
## Installation:
To install the package run
```sh
npm install @nfq/feature-flags
```
if you are in yarn
```sh
yarn add @nfq/feature-flags
```
or on pnpm
```sh
pnpm install @nfq/feature-flags
```

## Configuration:
To use feature flags there is some small configuration needed:
  - .babelrc:

    change it to an babel.config.js file because we need some functions.

    example:
    ```javascript
    const {withFeatureFlags} = require('@nfq/feature-flags/babel');

    module.exports = withFeatureFlags({
        plugins: [
            ['@babel/plugin-proposal-decorators', {legacy: true}],
            ['@babel/plugin-proposal-class-properties', {loose: true}],
            ['styled-components', {
                fileName: true,
                preprocess: false,
                pure: true,
                ssr: true
            }]
        ],
        presets: [
            [
                'next/babel',
                {'transform-react-remove-prop-types': {}}
            ]
        ]
    }, {
        deprecationEnv: 'live',
        featureFlagImport: '@app/features',
        jsxImport: '@nfq/feature-flags/jsx',
        jsxWithFeature: 'WithFeature',
        jsxWithoutFeature: 'WithoutFeature'
    });
    ```

  - .eslintrc:

    change it to an .eslintrc.js file because we need some functions.
    To prevent eslint from complaining about not existing modules there is an eslint function to set some rules for you.

    example:
    ```javascript
    const featureFlags = require('@nfq/feature-flags/eslint/import')(['@app/features', '@nfq/feature-flags/jsx']);

    module.exports = {
        extends: [
            '@nfq'
        ],
        rules: {
            ...featureFlags.rules
        }
    };
    ```

  - next.config.js:

    If you are in an nextjs environment you need some extra config to tell webpack not to cache your babel config. So here is also some little helper.

    example:
    ```javascript
    const {withFeatureFlags} = require('@nfq/feature-flags/next');

    module.exports = withFeatureFlags({
        // nextjs config like normal.
    });
    ```
  - package.json

    To tell webpack that your project is treeshakeble you need to set an flag for it.

    example:
    ```json
    {
        ...
        "sideEffects": [
            "**/*.css"
        ],
        ...
    }
    ```

    Also to tell the plugin and module on build time in which environment it is running you have to set an
    `FEATURE_ENV=` variable these define your possible environments.

    example:
    ```json
    {
        ...
        "scripts": {
            "build:live": "cross-env FEATURE_ENV=live next build && cross-env FEATURE_ENV=live next export",
            "build:stage": "cross-env FEATURE_ENV=stage next build && cross-env FEATURE_ENV=stage next export",
            "dev": "cross-env FEATURE_ENV=dev next dev",
        },
        ...
    }
    ```

  - feature files:

    Last but not least you need some feature files that define your flags for the environments.
    Filenames look always the same with `features.FEATURE_ENV.js` the FEATURE_ENV part is your defined environment.

## Configuration Settings (Babel Plugin)

| Option            | type   | Default                | Description                                                                     |
| ----------------- | ------ | ---------------------- | ------------------------------------------------------------------------------- |
| deprecationEnv    | string | live                   | The feature env identifier that gets checked to show deprecations.              |
| featureFlagImport | string | @app/features          | The import name to use if you want to import an feature flag                    |
| jsxImport         | string | @nfq/feature-flags/jsx | The import name to use if you want to import jsx helpers for react              |
| jsxWithFeature    | string | WithFeature            | The jsx component name to mark an subtree to only show with an specific feature |
| jsxWithoutFeature | string | WithoutFeature         | The jsx component name to mark an subtree to only show with an specific feature |

## JSX props

You can import to JSX components both names defined in the babel settings section.
Both have the exact same props you can use.
 - The `jsxWithFeature` component will only render its subtree if the feature is set to true.
 - The `jsxWithoutFeature` component will only render its subtree if the feature is set to false.

| Prop        | type                              | required           | Description |
| ----------- | --------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| feature     | FeatureFlag or Array[FeatureFlag] | :heavy_check_mark: | Defines the feature the component should look up to determine if it should render or not.                                                                                                                            |
| deprecateOn | TimeString                        |                    | Define an date on which the babel module will throw deprecation messages for this feature. If none is set you will get deprecation warnings if an feature is configured as true on the `deprecationEnv` environment. |

## Usage:
feature.live.js:
```javascript
module.exports = {COOL_FEATURE: false};
```
feature.stage.js:
```javascript
module.exports = {COOL_FEATURE: true};
```

### Plain js Examples:
```javascript
import {COOL_FEATURE} from '@app/features';

const oldFunktion = () => {
    /* ... */
}

const newShinyFunction = () => {
    /* ... */
}

const featureOrNot = () => {
    if (COOL_FEATURE) {
        newShinyFunction();
    } else {
        oldFunktion
    }
}
```

```javascript
import {COOL_FEATURE} from '@app/features';

const featureOrNot = () => {
    /* ... */
    (COOL_FEATURE) && console.log('OnlyNew')
    /* ... */
}
```

### React Examples:

```jsx
import {Component} from 'react';

import {COOL_FEATURE} from '@app/features';
import {WithFeature, WithoutFeature} from '@nfq/feature-flags/jsx';
import Test from 'Components/Test'; // gets eliminated if feature is not true
import Test2 from 'Components/Test2'; // gets eliminated if feature is true

export default class Test extends Component {
    render() {
        return (
            <div>
                <WithFeature feature={COOL_FEATURE}>
                    <p>This is only rendered and in the final bundle if the feature is active</p>
                    <Test />
                </WithFeature>
                <WithoutFeature feature={COOL_FEATURE}>
                    <p>This is only rendered and in the final bundle if the feature is inactive</p>
                    <Test2 />
                </WithoutFeature>
            </div>
        )
    }
}
```

deprecateOn:
```jsx
import {Component} from 'react';

import {COOL_FEATURE} from '@app/features';
import {WithFeature} from '@nfq/feature-flags/jsx';

export default class Test extends Component {
    render() {
        return (
            <div>
                <WithFeature deprecateOn="2021-07-14" feature={COOL_FEATURE}>
                    <p>Sends an deprecation warning on build time if date is greater then deprecateOn</p>
                </WithFeature>
            </div>
        )
    }
}
```

## Contributions:
.NFQ | Christoph Kruppe

## License:
The licence used is: `MIT`
Click on licence badge for licence details:
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Questions:
If you have any furter questions please contact the following email address:
email: c.kruppe@nfq.de
