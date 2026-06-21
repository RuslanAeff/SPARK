// Jest otomatik mock'u (node_modules komşusu __mocks__): react-native-reanimated 4'ü
// hafif bir stub ile değiştirir. Böylece testlerde gerçek ESM/worklet runtime'ı
// yüklenmez ve animasyon prop'ları (entering/exiting/layout) zararsızca ayıklanır.
const React = require('react');
const { View, Text, ScrollView } = require('react-native');

const strip = (Comp) =>
  React.forwardRef(({ entering, exiting, layout, ...rest }, ref) =>
    React.createElement(Comp, { ...rest, ref })
  );

// Layout/entering animasyon kurucuları: zincirlenebilir no-op (FadeInDown.delay(x).duration(y)).
const anim = () => {
  const o = { delay: () => o, duration: () => o, springify: () => o, build: () => () => {} };
  return o;
};

module.exports = {
  __esModule: true,
  default: {
    View: strip(View),
    Text: strip(Text),
    ScrollView: strip(ScrollView),
    createAnimatedComponent: (c) => c,
  },
  FadeInDown: anim(),
  FadeOutUp: anim(),
  FadeIn: anim(),
  SlideInRight: anim(),
  LinearTransition: anim(),
};
