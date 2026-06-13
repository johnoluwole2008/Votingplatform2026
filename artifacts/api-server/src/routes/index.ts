import { Router, type IRouter } from "express";
import healthRouter from "./health";
import electionRouter from "./election";
import authRouter from "./auth";
import ballotRouter from "./ballot";
import adminRouter from "./admin";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(electionRouter);
router.use(authRouter);
router.use(ballotRouter);
router.use(adminRouter);
router.use(storageRouter);

export default router;
