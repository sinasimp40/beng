declare module "hpp" {
  import type { RequestHandler } from "express";

  function hpp(): RequestHandler;

  export default hpp;
}