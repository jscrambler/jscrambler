# [![Jscrambler](https://media.jscrambler.com/images/logo_500px.png)](https://jscrambler.com/?utm_source=github.com&utm_medium=referral)

## Jscrambler

Jscrambler is a JavaScript protection technology for Web and Mobile Applications. Its main purpose is to enable JavaScript applications to become self-defensive and resilient to tampering and reverse engineering.

## JavaScript Protection Technology

Jscrambler includes three security layers:

- **Advanced Obfuscation**: transformations to Strings, Variables, Functions, and Objects, through reordering, encoding, splitting, renaming, and logic concealing techniques that make the code extremely difficult to read and reverse-engineer. Includes **control-flow flattening** by adding opaque predicates and irrelevant code clones and flattening the control-flow;
- **Code Locks**: ability to prevent the protected code from running outside whitelisted domains, browsers, date ranges, OS'es, and on rooted/jailbroken devices;
- **Runtime Protection**: anti-tampering and anti-debugging techniques, such as [Self-Defending](https://docs.jscrambler.com/code-integrity/documentation/transformations/self-defending) and [Self-Healing](https://docs.jscrambler.com/code-integrity/documentation/transformations/self-healing).

### Polymorphic Behavior

Jscrambler has a **Polymorphic Behavior**, so each new code deployment generates a **different protected output** with the same code functionality.

### Source Maps

**[Source maps](https://docs.jscrambler.com/code-integrity/documentation/source-maps)** provide a way of mapping obfuscated code back to its original source code, helping the debugging process of obfuscated code as if you were running the original source code.

### JavaScript Threat Monitoring

Jscrambler displays [real-time notifications](https://jscrambler.com/products/javascript-threat-monitoring?utm_source=github.com&utm_medium=referral) whenever there is a threat to the protected code. Any attempt to modify or debug protected code will display a detailed alert on the Live Feed dashboard.

### Profiling

This [feature](https://docs.jscrambler.com/code-integrity/documentation/profiling) is specifically aimed at performance-sensitive apps. It analyzes which parts of the code are critical to performance and applies the best balance of transformations when protecting the code.

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
- [Jscrambler 101 — Countermeasures](https://blog.jscrambler.com/jscrambler-101-countermeasures/?utm_source=github.com&utm_medium=referral)
- [Jscrambler 101 — Self-Healing](https://blog.jscrambler.com/jscrambler-101-self-healing/?utm_source=github.com&utm_medium=referral)
- [Jscrambler 101 — Profiling](https://blog.jscrambler.com/jscrambler-101-profiling/?utm_source=github.com&utm_medium=referral)
- [Jscrambler 101 — App Classification](https://blog.jscrambler.com/jscrambler-101-app-classification/?utm_source=github.com&utm_medium=referral)
- [Jscrambler 101 — Memory Protection](https://blog.jscrambler.com/jscrambler-101-memory-protection/?utm_source=github.com&utm_medium=referral)
