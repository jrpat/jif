export type AutocompleteFlow = "top-to-bottom" | "bottom-to-top";
export type AutocompleteAction = "next" | "previous";

export type AutocompleteKeyEvent = Readonly<{
  name: string;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
  option: boolean;
}>;

export function moveAutocompleteSelection(
  currentIndex: number | null,
  itemCount: number,
  action: AutocompleteAction,
): number | null {
  if (itemCount <= 0) {
    return null;
  }

  if (currentIndex === null) {
    return action === "next" ? 0 : itemCount - 1;
  }

  if (action === "next") {
    return (currentIndex + 1) % itemCount;
  }

  return (currentIndex - 1 + itemCount) % itemCount;
}

export function getAutocompleteAction(
  event: AutocompleteKeyEvent,
  flow: AutocompleteFlow,
): AutocompleteAction | null {
  if (event.meta || event.option) {
    return null;
  }

  if (event.name === "tab") {
    return event.shift ? "previous" : "next";
  }

  if (event.ctrl) {
    if (event.name === "j" || event.name === "n") {
      return flow === "top-to-bottom" ? "next" : "previous";
    }
    if (event.name === "k" || event.name === "p") {
      return flow === "top-to-bottom" ? "previous" : "next";
    }
    return null;
  }

  if (event.name === "down") {
    return flow === "top-to-bottom" ? "next" : "previous";
  }

  if (event.name === "up") {
    return flow === "top-to-bottom" ? "previous" : "next";
  }

  return null;
}
