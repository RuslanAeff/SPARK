'use strict';

// Jest worker'ları başladıktan sonra process.env.TZ değiştirmek platformlar
// arasında aynı sonucu vermiyor. Native reminder DST sözleşmesini CI ve yerel
// geliştirmede deterministik sınamak için saat dilimini Jest yüklenmeden önce
// sabitliyoruz. Uygulamanın çalışma zamanı bu ayardan etkilenmez.
process.env.TZ = 'Europe/Warsaw';

require('jest/bin/jest');
