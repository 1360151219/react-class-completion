# react-class-completion

a vscode extension for react developer

## Get Started

search for 'psfe-react-extension' in VScode Extensions and install it.

## features

- [x] **support class name completions for `scss/css` from `.tsx` files below the same dir path**.
  - [x] ordinary className in JSXAttribute.
  - [x] variable className in JSXAttribute. example：
  ```ts
  // src/index,tsx
  const prefix = 'foo';
  export const foo = () => (
    <div>
      <div className="foo">foo</div>
      <div className="foo2">foo</div>
      <div className={`${prefix}3`}>foo</div>
      <div className={`${prefix}-${prefix}-4`}>foo</div>
    </div>
  );
  ```
  ![](./variable_completion.jpg)
  - [x] listening for classname changing in `.tsx` file.
- [] **support go to defination from classname in `scss/css` to the relative `tsx` file**
