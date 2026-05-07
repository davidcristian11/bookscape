import '@testing-library/jest-dom';

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.IntersectionObserver = global.IntersectionObserver || MockIntersectionObserver;
global.alert = global.alert || (() => {});
global.confirm = global.confirm || (() => true);
