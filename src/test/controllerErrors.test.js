import { afterEach, describe, expect, test, vi } from 'vitest';
import { authController } from '../controllers/authController.js';
import { categoryController } from '../controllers/categoryController.js';
import { dashboardController } from '../controllers/dashboardController.js';
import { reportController } from '../controllers/reportController.js';
import { supportController } from '../controllers/supportController.js';
import { userController } from '../controllers/userController.js';
import { authService } from '../services/authService.js';
import { categoryService } from '../services/categoryService.js';
import { dashboardService } from '../services/dashboardService.js';
import { reportService } from '../services/reportService.js';
import { supportService } from '../services/supportService.js';
import { userService } from '../services/userService.js';

const request = {
  body: {},
  file: undefined,
  params: { id: '12' },
  query: {},
  user: { id: 7 },
};

function response() {
  const res = {
    json: vi.fn(),
    sendFile: vi.fn(),
    status: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('controllers pass service failures to Express', () => {
  const cases = [
    [authController, authService, 'register', 'register'],
    [authController, authService, 'login', 'login'],
    [authController, authService, 'getMe', 'getMe'],
    [categoryController, categoryService, 'getAllCategories', 'getAllCategories'],
    [categoryController, categoryService, 'getCategoryById', 'getCategoryById'],
    [categoryController, categoryService, 'createCategory', 'createCategory'],
    [categoryController, categoryService, 'updateCategory', 'updateCategory'],
    [categoryController, categoryService, 'deleteCategory', 'deleteCategory'],
    [dashboardController, dashboardService, 'getSummary', 'getSummary'],
    [dashboardController, dashboardService, 'getByCategory', 'getByCategory'],
    [dashboardController, dashboardService, 'getByStatus', 'getByStatus'],
    [dashboardController, dashboardService, 'getPriorityReports', 'getPriorityReports'],
    [reportController, reportService, 'getReports', 'getReports'],
    [reportController, reportService, 'getReportById', 'getReportById'],
    [reportController, reportService, 'createReport', 'createReport'],
    [reportController, reportService, 'updateReport', 'updateReport'],
    [reportController, reportService, 'updateReportPhoto', 'updateReportPhoto'],
    [reportController, reportService, 'deleteReport', 'deleteReport'],
    [reportController, reportService, 'updateStatus', 'updateStatus'],
    [reportController, reportService, 'updateUrgency', 'updateUrgency'],
    [reportController, reportService, 'getReportHistory', 'getReportHistory'],
    [reportController, reportService, 'getReportPhoto', 'getPhotoFilePath'],
    [supportController, supportService, 'addSupport', 'addSupport'],
    [supportController, supportService, 'removeSupport', 'removeSupport'],
    [supportController, supportService, 'getSupports', 'getSupports'],
    [userController, userService, 'getMe', 'getProfile'],
    [userController, userService, 'updateMe', 'updateProfile'],
    [userController, userService, 'getAllUsers', 'getAllUsers'],
  ];

  test.each(cases)('$2.$3 failure reaches next', async (controller, service, controllerMethod, serviceMethod) => {
    const error = new Error(`${serviceMethod} failed`);
    vi.spyOn(service, serviceMethod).mockRejectedValue(error);
    const next = vi.fn();

    await controller[controllerMethod](request, response(), next);

    expect(next).toHaveBeenCalledWith(error);
  });

  test('logout forwards response failures', async () => {
    const error = new Error('response failed');
    const res = response();
    res.status.mockImplementation(() => {
      throw error;
    });
    const next = vi.fn();

    await authController.logout(request, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
