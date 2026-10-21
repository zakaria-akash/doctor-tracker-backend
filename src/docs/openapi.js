export const openapiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Doctor Tracker API',
    version: '1.0.0',
    description:
      'Sign in with `POST /auth/login`, click **Authorize**, then paste the returned token. Demo: admin@doctortracker.test / Admin@12345',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { const: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
        },
      },
      PageMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
          hasNextPage: { type: 'boolean' },
          hasPrevPage: { type: 'boolean' },
        },
      },
      DoctorInput: {
        type: 'object',
        required: ['name', 'specialization', 'hospital', 'phone', 'email'],
        properties: {
          name: { type: 'string', example: 'Dr. Ayesha Rahman' },
          specialization: { type: 'string', example: 'Cardiology' },
          hospital: { type: 'string', example: 'Riverside Heart Institute' },
          phone: { type: 'string', example: '+880 1711-000000' },
          email: {
            type: 'string',
            format: 'email',
            example: 'ayesha.rahman@doctortracker.test',
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        security: [],
        summary: 'Liveness probe',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        security: [],
        summary: 'Sign in and receive a JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Token issued' },
          401: { description: 'Invalid credentials' },
          429: { description: 'Rate limited' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current authenticated user',
        responses: { 200: { description: 'User' } },
      },
    },
    '/doctors': {
      get: {
        tags: ['Doctors'],
        summary: 'List doctors',
        parameters: [
          'page',
          'limit',
          'search',
          'specialization',
          'hospital',
          'from',
          'to',
          'sort',
        ].map((name) => ({ name, in: 'query', schema: { type: 'string' } })),
        responses: {
          200: { description: 'Paginated doctors' },
          401: { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Doctors'],
        summary: 'Create a doctor (admin)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/DoctorInput' } } },
        },
        responses: {
          201: { description: 'Created' },
          403: { description: 'Forbidden' },
          409: { description: 'Duplicate email' },
          422: { description: 'Validation error' },
        },
      },
    },
    '/doctors/{id}': {
      get: {
        tags: ['Doctors'],
        summary: 'Doctor profile',
        responses: { 200: { description: 'Doctor' } },
      },
      patch: {
        tags: ['Doctors'],
        summary: 'Update a doctor (admin)',
        responses: { 200: { description: 'Updated' } },
      },
    },
    '/doctors/{id}/patients': {
      get: {
        tags: ['Doctors'],
        summary: "List a doctor's patients",
        responses: { 200: { description: 'Patients' } },
      },
      post: {
        tags: ['Doctors'],
        summary: 'Add a patient (admin)',
        responses: { 201: { description: 'Created' } },
      },
    },
    '/doctors/{id}/patients/{patientId}': {
      delete: {
        tags: ['Doctors'],
        summary: 'Delete a patient (admin)',
        responses: { 204: { description: 'Deleted' } },
      },
    },
    '/patients': {
      get: {
        tags: ['Patients'],
        summary: 'List patients',
        responses: { 200: { description: 'Paginated patients' } },
      },
    },
    '/patients/{id}': {
      get: {
        tags: ['Patients'],
        summary: 'Patient detail',
        responses: { 200: { description: 'Patient' } },
      },
      patch: {
        tags: ['Patients'],
        summary: 'Update patient (admin)',
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['Patients'],
        summary: 'Delete patient (admin)',
        responses: { 204: { description: 'Deleted' } },
      },
    },
    '/analytics/overview': {
      get: {
        tags: ['Analytics'],
        summary: 'Dashboard aggregates',
        responses: { 200: { description: 'Overview' } },
      },
    },
    '/meta/options': {
      get: {
        tags: ['Meta'],
        summary: 'Filter options',
        responses: { 200: { description: 'Options' } },
      },
    },
  },
};
