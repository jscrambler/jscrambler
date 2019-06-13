# [![Jscrambler](https://media.jscrambler.com/images/logo_500px.png)](https://jscrambler.com/?utm_source=github.com&utm_medium=referral)

## Jscrambler

Jscrambler is a JavaScript protection technology for Web and Mobile Applications. Its main purpose is to enable JavaScript applications to become self-defensive and resilient to tampering and reverse engineering.

## JavaScript Protection Technology

Jscrambler includes four security layers:

- **Advanced Obfuscation**: transformations to Strings, Variables, Functions, and Objects, through reordering, encoding, splitting, renaming, and logic concealing techniques that make the code extremely difficult to read and reverse-engineer. Includes **control-flow flattening** by adding opaque predicates and irrelevant code clones and flattening the control-flow;
- **Code Locks**: ability to prevent the protected code from running outside whitelisted domains, browsers, date ranges, and OS'es;
- **Self-Defending**: anti-tampering and anti-debugging techniques that break the code functionality when debugging or a tampering attempt occurs;
- **Self-Healing**: ability to recover from tampering attacks by preserving the original behavior of the application even after attacker modifications.

### Polymorphic Behavior

Jscrambler has a **Polymorphic Behavior**, so each new code deployment generates a **different protected output** with the same code functionality.

### Source Maps

**Source maps** provide a way of mapping obfuscated code back to its original source code, helping the debugging process of obfuscated code as if you were running the original source code.

### JavaScript Threat Monitoring

From version 6.0 onwards, Jscrambler enables monitoring threats to protected code in real-time. Any attempt to modify or debug protected code will display a detailed alert in the Live Feed dashboard.

## Jscrambler JavaScript Client and Integrations

You can integrate Jscrambler into your build process easily with its API client. It also has several integrations.

- [JavaScript CLI and API Client](packages/jscrambler-cli)
- [Grunt](packages/grunt-jscrambler)
- [Gulp](packages/gulp-jscrambler)
- [Webpack](packages/jscrambler-webpack-plugin)
- [Ember](packages/ember-cli-jscrambler)
- [Metro](packages/jscrambler-metro-plugin)

## Jscrambler JavaScript Framework/Library Integrations

- [React](https://blog.jscrambler.com/protecting-your-react-js-source-code-with-jscrambler/?utm_source=github.com&utm_medium=referral)
- [Angular](https://blog.jscrambler.com/how-to-protect-angular-code-against-theft-and-reverse-engineering/?utm_source=github.com&utm_medium=referral)
- [Angular.js](https://blog.jscrambler.com/how-to-protect-your-angular-js-application-with-jscrambler/?utm_source=github.com&utm_medium=referral)
- [Vue.js](https://blog.jscrambler.com/how-to-protect-your-vue-js-application-with-jscrambler/?utm_source=github.com&utm_medium=referral)
- [Ember.js](https://docs.jscrambler.com/code-integrity/frameworks-and-libraries/emberjs?utm_source=github.com&utm_medium=referral)
- [Meteor](https://docs.jscrambler.com/code-integrity/frameworks-and-libraries/meteor?utm_source=github.com&utm_medium=referral)
- [Ionic](https://blog.jscrambler.com/protecting-hybrid-mobile-apps-with-ionic-and-jscrambler/?utm_source=github.com&utm_medium=referral)
- [NativeScript](https://blog.jscrambler.com/protecting-your-nativescript-source-code-with-jscrambler/?utm_source=github.com&utm_medium=referral)
- [React Native](https://blog.jscrambler.com/how-to-protect-react-native-apps-with-jscrambler/?utm_source=github.com&utm_medium=referral)
- [More information about Framework Compatibility](https://jscrambler.com/javascript-frameworks-and-libraries#compatible-frameworks?utm_source=github.com&utm_medium=referral)

## Jscrambler Tutorials

- [Jscrambler Docs](https://docs.jscrambler.com/?utm_source=github.com&utm_medium=referral)
- [Jscrambler 101 — First Use](https://blog.jscrambler.com/jscrambler-101-first-use/?utm_source=github.com&utm_medium=referral)
- [Jscrambler 101 — Code Annotations](https://blog.jscrambler.com/jscrambler-101-code-annotations/?utm_source=github.com&utm_medium=referral)
- [Jscrambler 101 — Self Defending](https://blog.jscrambler.com/jscrambler-101-self-defending/?utm_source=github.com&utm_medium=referral)
- [Jscrambler 101 — Control Flow Flattening](https://blog.jscrambler.com/jscrambler-101-control-flow-flattening/?utm_source=github.com&utm_medium=referral)
- [Jscrambler 101 — Code Locks](https://blog.jscrambler.com/jscrambler-101-code-locks/?utm_source=github.com&utm_medium=referral)
- [Jscrambler 101 — How to use the CLI](https://blog.jscrambler.com/jscrambler-101-how-to-use-the-cli/?utm_source=github.com&utm_medium=referral)
- [Jscrambler 101 — Source Maps](https://blog.jscrambler.com/jscrambler-101-source-maps/?utm_source=github.com&utm_medium=referral)
