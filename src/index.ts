import React, { EffectCallback, DependencyList } from 'react';

function useMountEffect(effect: EffectCallback) {
  React.useEffect(effect, []);
}

function useIsJustMountedState(): boolean {
  const isJustMounted = React.useRef(true);

  if (isJustMounted.current) {
    isJustMounted.current = false;

    return true;
  }

  return isJustMounted.current;
}

function useUpdateOnlyEffect(
  effect: EffectCallback,
  dependencies?: DependencyList
) {
  const isJustMounted = useIsJustMountedState();

  React.useEffect(() => {
    if (!isJustMounted) {
      return effect();
    }
  }, dependencies);
}

function useForceUpdate() {
  const triggerUpdate = React.useState({})[1];

  return React.useCallback(() => {
    triggerUpdate({});
  }, []);
}

// typescript has issues with unique symbol type for Set and Record
// this is a work around
const uniqueSymbol: unique symbol = Symbol('_');
type UniqueSymbol = typeof uniqueSymbol;

type Selector<State> = (state: State) => Partial<State>;
type EqualityCheck<State> = (
  prevSlice: Partial<State>,
  nextSlice: Partial<State>
) => boolean;
interface Listener<State> {
  triggerUpdate: ReturnType<typeof useForceUpdate>;
  prevSlice: Partial<State>;
  selector: Selector<State>;
  equalityCheck: EqualityCheck<State>;
}
type Listeners<State> = Record<UniqueSymbol, Listener<State>>;
type StateUpdaterCallback<State> = (prevState: State) => State;
type StateUpdater<State> = (arg: StateUpdaterCallback<State> | State) => void;
type UseState<State> = (
  selector?: Selector<State>,
  equalityCheck?: EqualityCheck<State>
) => Partial<State>;
type GetState<State> = () => State;

type StateTypes =
  | Record<string | number | symbol, unknown>
  | string
  | number
  | boolean;
export function createStore<State extends StateTypes | Array<StateTypes>>(
  initialState: State
): [UseState<State>, StateUpdater<State>, GetState<State>] {
  const listenerKeys = new Set<UniqueSymbol>();
  let listeners: Listeners<State> = {} as Listeners<State>;

  const store = {
    state: initialState,
    getState(): State {
      return this.state;
    },
  };

  function updater(arg: StateUpdaterCallback<State> | State): void {
    let newState: State;
    if (typeof arg === 'function') {
      newState = arg(store.state);
    } else {
      newState = arg;
    }

    store.state = newState;

    listenerKeys.forEach((key: UniqueSymbol) => {
      const listener = listeners[key];

      const nextSlice = listener.selector(store.state);

      if (!listener.equalityCheck(listener.prevSlice, nextSlice)) {
        listener.triggerUpdate();
      }
    });
  }

  const defaultSelector: Selector<State> = (state) => state;
  const defaultEqualityCheck: EqualityCheck<State> = (prevSlice, nextSlice) =>
    prevSlice === nextSlice;

  const useStore = (
    selector: Selector<State> = defaultSelector,
    equalityCheck: EqualityCheck<State> = defaultEqualityCheck
  ): Partial<State> => {
    const state = store.getState();

    const listenerKeyRef = React.useRef(Symbol('listener'));

    const triggerUpdate = useForceUpdate();

    useMountEffect(() => {
      const listenerKey = listenerKeyRef.current;
      listenerKeys.add(listenerKey as UniqueSymbol);
      listeners[listenerKey] = {
        triggerUpdate,
        prevSlice: selector(state),
        selector,
        equalityCheck,
      };

      return () => {
        listenerKeys.delete(listenerKey as UniqueSymbol);
        delete listeners[listenerKey];
      };
    });

    useUpdateOnlyEffect(() => {
      const listenerKey = listenerKeyRef.current;
      listeners[listenerKey].selector = selector;
    }, [selector]);

    useUpdateOnlyEffect(() => {
      const listenerKey = listenerKeyRef.current;
      listeners[listenerKey].equalityCheck = equalityCheck;
    }, [equalityCheck]);

    useUpdateOnlyEffect(() => {
      const listenerKey = listenerKeyRef.current;
      listeners[listenerKey].prevSlice = selector(state);
    });

    return selector(state);
  };

  return [useStore, updater, store.getState];
}
