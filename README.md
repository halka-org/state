# @halka/state

![Bundle Size](https://badgen.net/bundlephobia/minzip/@halka/state) ![npm version](https://badgen.net/npm/v/@halka/state) ![types](https://badgen.net/npm/types/@halka/state) ![license](https://badgen.net/github/license/halka-org/state)

`@halka/state` is a lightweight global state solution for react with zero external dependencies and clean hooks API.

## Installation

```sh
npm install @halka/state
```

## Examples

### Creating a store

```js
import { createStore } from '@halka/state';

const useCounter = createStore(0);

// OR

const useCounter = createStore(() => 0);
```

The library exports only one function i.e. `createStore`. You can use it to create a new store.

`createStore` accepts only one argument that is the initial state of the store. It can be anything a primitive value like number, string, boolean or an array or object. It returns a tuple. It can also accept a function that returns your initialState. This can be used to lazily initial your state.

The first element `useCounter` is a React hook that can be used inside any React functional component to select a slice of the current state from the store.

### Using the state hook

```js
function Counter() {
  const count = useCounter();

  return <span>{count}</span>;
}
```

The `useCounter` hook returns the selected slice of the current state.

Here, we do not pass any argument to the hook because we want the state as is from the store. But, the hook accepts two arguments -

- `selector` - _[optional]_ It accepts a callback function that gets passed the entire current state from the store and can return a partial slice of the state or derived state for the component to use. Use this to only subscribe to the state your component needs preventing unnecessary renders. By default, the entire state is returned.
- `equalityCheck` - _[optional]_ It accepts a callback function that gets passed the previous state slice (return value of the `selector`)
  as the first argument and the next state slice. It must return a boolean value (`true` if the state slice is to be updated, otherwise `false`). Use this to further fine tune your re-rendering logic. By default, a shallow comparison is done to check if there are any updates.

### Using a state selector

```js
const cubeSelector = (count) => count ** count;

function SquaredCounter() {
  const countCube = useCounter(cubeSelector);

  return <span>{countCube}</span>;
}
```

Here, we are passing a selector callback function that gives us the cube of the count state. This selector is used to get a derived state here.

### Using a custom equality check

```js
const absoluteValueCheck = (prev, next) => Math.abs(prev) === Math.abs(next);

function AbsoluteSquaredCounter() {
  const countCube = useCounter(cubeSelector, absoluteValueCheck);

  return <span>{countCube}</span>;
}
```

Here, we are passing a custom equality check function to check if the absolute value is the same as before. If yes, then we don't update it.

### Updating state

```js
import { createStore } from '@halka/state';

const initialCount = 0;
const useCounter = createStore(initialCount);

const reset = () => {
  useCounter.set(intialCount);
};

const increment = () => {
  useCounter.set((prevCount) => prevCount + 1);
};

function Counter() {
  const count = useCounter();

  const decrement = () => {
    useCounter.set((prevCount) => prevCount - 1);
  };

  return <span>{count}</span>;
}
```

State updater function `set` is accessible on the hook as a property itself.

You can pass the next state value directly to the function like we did in our `reset` handler.

But, if your next state depends on the previous state than you can also pass a callback function to the state updater which gets passed the previous state and must return the next state. Like we used in our `increment` and `decrement` handler.

This API is similar to state update function returned by `useState`.

### Updating nested state with Immer

The re-render triggers are based on shallow referential equality checks. So, we shouldn't mutate the state directly updating nested properties in objects and arrays become a hassle. For example -

```js
const markTodoComplete = (todoIndex) => {
  // we need to use map so that we create a new array
  // to trigger a state update (we shouldn't directly mutate it)
  // APIs like slice, map, filter, reduce return new arrays

  // iterate over all the todos, keep all the todos same except the one we are trying to mark as complete
  useTodos.set((prevTodos) =>
    prevTodos.map((todo, index) =>
      index === todoIndex ? { ...todo, completed: true } : todo
    )
  );
};
```

Not to worry, you can use the amazing [Immer](https://immerjs.github.io/immer) library to help with it. It lets you use APIs that mutate data while keeping the resultant data still immutable.

Let's look at how we can use immer to make the update above simpler.

```js
import produce from 'immer';

const toggleTodo = (todoIndex) => {
  useTodos.set(
    produce((prevTodos) => {
      prevTodos[todoIndex].completed = true;
    })
  );
};
```

We are using the [curried producer API from Immer](https://immerjs.github.io/immer/docs/curried-produce).

To use immer in a more composable way, you can decorate the updateState itself in the following way -

```js
import { createStore } from '@halka/state';
import produce from 'immer';

// some initial state value
import initialState from './initialState';

const useStore = createStore(initialState);

// compose the updater function with immer curried producer API
const updateStateWithImmer = (fn) => useStore.set(produce(fn));

// Then, the toggle todo example from above will look like this
const toggleTodo = (todoIndex) => {
  updateStateWithImmer((prevTodos) => {
    prevTodos[todoIndex].completed = true;
  });
};
```

### Accessing state outside of React

You can access the state outside of react or without using the hook returned by `createStore` as well.

State getter function `get` is accessible on the hook as a property itself just like `set`.

```js
const useStore = createStore(initialState);

const state = useStore.get();
```

You can use it even inside a `useEffect` to manually trigger updates and much more.

## Inspirations and Prior work we referred

- [Zustand](https://github.com/react-spring/zustand)
- [Unstated-Next](https://github.com/jamiebuilds/unstated-next)

This library won't be possible without these and many more libraries existing in the open source communities. Big thanks to the whole community.
