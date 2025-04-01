class InvalidPathError extends Error{
  name = "InvalidPathError";

  constructor(message?: string){
    super(message);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, InvalidPathError.prototype);
  }
}
class NoMatchError extends Error{
  name = "NoMatchError";

  constructor(message?: string){
    super(message);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, NoMatchError.prototype);
  }
}

export {
  InvalidPathError,
  NoMatchError
};