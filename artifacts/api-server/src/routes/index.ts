import { Router, type IRouter } from "express";
import healthRouter from "./health";
import notesRouter from "./notes";
import calendarRouter from "./calendar";
import gmailRouter from "./gmail";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/notes", notesRouter);
router.use("/calendar", calendarRouter);
router.use("/gmail", gmailRouter);
router.use("/auth", authRouter);

export default router;
