import { Router, type IRouter } from "express";
import healthRouter from "./health";
import notesRouter from "./notes";
import calendarRouter from "./calendar";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/notes", notesRouter);
router.use("/calendar", calendarRouter);

export default router;
