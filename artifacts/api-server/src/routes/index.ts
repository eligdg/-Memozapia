import { Router, type IRouter } from "express";
import healthRouter from "./health";
import notesRouter from "./notes";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/notes", notesRouter);

export default router;
