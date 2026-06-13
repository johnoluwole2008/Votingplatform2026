import { Router } from "express";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import votersRouter from "./voters";
import officesRouter from "./offices";
import resultsRouter from "./results";
import auditRouter from "./audit";
import settingsRouter from "./settings";
import accountsRouter from "./accounts";
import studentsRouter from "./students";
import invitesRouter from "./invites";
import emailRouter from "./email";
import voterImportRouter from "./voter-import";

const router = Router();

router.use(authRouter);
router.use(dashboardRouter);
router.use(votersRouter);
router.use(officesRouter);
router.use(resultsRouter);
router.use(auditRouter);
router.use(settingsRouter);
router.use(accountsRouter);
router.use(studentsRouter);
router.use(invitesRouter);
router.use(emailRouter);
router.use(voterImportRouter);

export default router;
