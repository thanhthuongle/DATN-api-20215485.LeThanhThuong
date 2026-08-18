resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com"
  ]

  tags = {
    Name = "github-actions"
  }
}

data "aws_iam_policy_document" "github_actions_deploy_assume_role" {
  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRoleWithWebIdentity"
    ]

    principals {
      type = "Federated"

      identifiers = [
        aws_iam_openid_connect_provider.github_actions.arn
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"

      values = [
        "sts.amazonaws.com"
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"

      values = [
        "repo:thanhthuongle@92387369/HeyMoney-API@967128973:environment:production"
      ]
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name                 = "heymoney-production-github-deploy-role"
  assume_role_policy   = data.aws_iam_policy_document.github_actions_deploy_assume_role.json
  max_session_duration = 3600

  tags = {
    Name = "heymoney-production-github-deploy-role"
  }
}

data "aws_iam_policy_document" "github_actions_deploy_permissions" {
  statement {
    sid    = "ECRLogin"
    effect = "Allow"

    actions = [
      "ecr:GetAuthorizationToken"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "PushAndScanApplicationImage"
    effect = "Allow"

    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:DescribeImageScanFindings",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:StartImageScan",
      "ecr:UploadLayerPart"
    ]

    resources = [
      aws_ecr_repository.api.arn
    ]
  }

  statement {
    sid    = "RegisterTaskDefinition"
    effect = "Allow"

    actions = [
      "ecs:DescribeTaskDefinition",
      "ecs:RegisterTaskDefinition"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "DeployApplicationService"
    effect = "Allow"

    actions = [
      "ecs:DescribeServices",
      "ecs:UpdateService"
    ]

    resources = [
      aws_ecs_service.api.id
    ]
  }

  statement {
    sid    = "PassECSTaskRoles"
    effect = "Allow"

    actions = [
      "iam:PassRole"
    ]

    resources = [
      aws_iam_role.ecs_execution.arn,
      aws_iam_role.ecs_task.arn
    ]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"

      values = [
        "ecs-tasks.amazonaws.com"
      ]
    }
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name   = "heymoney-production-github-deploy"
  role   = aws_iam_role.github_actions_deploy.id
  policy = data.aws_iam_policy_document.github_actions_deploy_permissions.json
}

data "aws_iam_policy_document" "github_actions_terraform_plan_assume_role" {
  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRoleWithWebIdentity"
    ]

    principals {
      type = "Federated"

      identifiers = [
        aws_iam_openid_connect_provider.github_actions.arn
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"

      values = [
        "sts.amazonaws.com"
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"

      values = [
        "repo:thanhthuongle@92387369/HeyMoney-API@967128973:pull_request"
      ]
    }
  }
}

resource "aws_iam_role" "github_actions_terraform_plan" {
  name                 = "heymoney-production-github-terraform-plan-role"
  assume_role_policy   = data.aws_iam_policy_document.github_actions_terraform_plan_assume_role.json
  max_session_duration = 3600

  tags = {
    Name = "heymoney-production-github-terraform-plan-role"
  }
}

data "aws_iam_policy_document" "github_actions_terraform_apply_assume_role" {
  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRoleWithWebIdentity"
    ]

    principals {
      type = "Federated"

      identifiers = [
        aws_iam_openid_connect_provider.github_actions.arn
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"

      values = [
        "sts.amazonaws.com"
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"

      values = [
        "repo:thanhthuongle@92387369/HeyMoney-API@967128973:environment:production"
      ]
    }
  }
}

resource "aws_iam_role" "github_actions_terraform_apply" {
  name                 = "heymoney-production-github-terraform-apply-role"
  assume_role_policy   = data.aws_iam_policy_document.github_actions_terraform_apply_assume_role.json
  max_session_duration = 3600

  tags = {
    Name = "heymoney-production-github-terraform-apply-role"
  }
}

resource "aws_iam_role_policy_attachment" "github_actions_terraform_plan_read_only" {
  role       = aws_iam_role.github_actions_terraform_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

data "aws_iam_policy_document" "github_actions_terraform_plan_state" {
  statement {
    sid    = "ListTerraformState"
    effect = "Allow"

    actions = [
      "s3:ListBucket"
    ]

    resources = [
      "arn:aws:s3:::heymoney-terraform-state-232499238146-ap-southeast-1"
    ]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"

      values = [
        "production/terraform.tfstate*"
      ]
    }
  }

  statement {
    sid    = "ReadTerraformState"
    effect = "Allow"

    actions = [
      "s3:GetObject"
    ]

    resources = [
      "arn:aws:s3:::heymoney-terraform-state-232499238146-ap-southeast-1/production/terraform.tfstate"
    ]
  }

  statement {
    sid    = "ManageTerraformStateLock"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]

    resources = [
      "arn:aws:s3:::heymoney-terraform-state-232499238146-ap-southeast-1/production/terraform.tfstate.tflock"
    ]
  }
}

resource "aws_iam_role_policy" "github_actions_terraform_plan_state" {
  name   = "heymoney-production-terraform-plan-state"
  role   = aws_iam_role.github_actions_terraform_plan.id
  policy = data.aws_iam_policy_document.github_actions_terraform_plan_state.json
}

data "aws_iam_policy_document" "github_actions_terraform_apply_state" {
  statement {
    sid    = "ListTerraformState"
    effect = "Allow"

    actions = [
      "s3:ListBucket"
    ]

    resources = [
      "arn:aws:s3:::heymoney-terraform-state-232499238146-ap-southeast-1"
    ]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"

      values = [
        "production/terraform.tfstate*"
      ]
    }
  }

  statement {
    sid    = "ManageTerraformState"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject"
    ]

    resources = [
      "arn:aws:s3:::heymoney-terraform-state-232499238146-ap-southeast-1/production/terraform.tfstate"
    ]
  }

  statement {
    sid    = "ManageTerraformStateLock"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]

    resources = [
      "arn:aws:s3:::heymoney-terraform-state-232499238146-ap-southeast-1/production/terraform.tfstate.tflock"
    ]
  }
}

resource "aws_iam_role_policy" "github_actions_terraform_apply_state" {
  name   = "heymoney-production-terraform-apply-state"
  role   = aws_iam_role.github_actions_terraform_apply.id
  policy = data.aws_iam_policy_document.github_actions_terraform_apply_state.json
}

data "aws_iam_policy_document" "github_actions_terraform_apply_infrastructure" {
  statement {
    sid    = "ManageProductionNetwork"
    effect = "Allow"

    actions = [
      "ec2:*"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ManageProductionLoadBalancer"
    effect = "Allow"

    actions = [
      "elasticloadbalancing:*"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ManageProductionCertificate"
    effect = "Allow"

    actions = [
      "acm:AddTagsToCertificate",
      "acm:DeleteCertificate",
      "acm:DescribeCertificate",
      "acm:ListTagsForCertificate",
      "acm:RemoveTagsFromCertificate",
      "acm:RequestCertificate"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ManageProductionECS"
    effect = "Allow"

    actions = [
      "ecs:*"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ManageProductionECR"
    effect = "Allow"

    actions = [
      "ecr:*"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ManageProductionLogs"
    effect = "Allow"

    actions = [
      "logs:*"
    ]

    resources = [
      "arn:aws:logs:ap-southeast-1:232499238146:log-group:/ecs/heymoney-production-api",
      "arn:aws:logs:ap-southeast-1:232499238146:log-group:/ecs/heymoney-production-api:*"
    ]
  }

  statement {
    sid    = "DescribeCloudWatchLogGroups"
    effect = "Allow"

    actions = [
      "logs:DescribeLogGroups"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ManageProductionSecretsMetadata"
    effect = "Allow"

    actions = [
      "secretsmanager:CreateSecret",
      "secretsmanager:DeleteSecret",
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetResourcePolicy",
      "secretsmanager:ListSecretVersionIds",
      "secretsmanager:PutResourcePolicy",
      "secretsmanager:RemoveRegionsFromReplication",
      "secretsmanager:ReplicateSecretToRegions",
      "secretsmanager:RestoreSecret",
      "secretsmanager:RotateSecret",
      "secretsmanager:StopReplicationToReplica",
      "secretsmanager:TagResource",
      "secretsmanager:UntagResource",
      "secretsmanager:UpdateSecret",
      "secretsmanager:UpdateSecretVersionStage",
      "secretsmanager:ValidateResourcePolicy"
    ]

    resources = [
      "arn:aws:secretsmanager:ap-southeast-1:232499238146:secret:heymoney/production/*"
    ]
  }

  statement {
    sid    = "ManageProductionBudget"
    effect = "Allow"

    actions = [
      "budgets:ListTagsForResource",
      "budgets:ModifyBudget",
      "budgets:TagResource",
      "budgets:UntagResource",
      "budgets:ViewBudget"
    ]

    resources = [
      "arn:aws:budgets::232499238146:budget/heymoney-production-monthly-cost"
    ]
  }

  statement {
    sid    = "ReadIAMConfiguration"
    effect = "Allow"

    actions = [
      "iam:GetOpenIDConnectProvider",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
      "iam:ListPolicyVersions",
      "iam:ListRolePolicies",
      "iam:ListRoleTags"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ManageGitHubOIDCProvider"
    effect = "Allow"

    actions = [
      "iam:AddClientIDToOpenIDConnectProvider",
      "iam:CreateOpenIDConnectProvider",
      "iam:DeleteOpenIDConnectProvider",
      "iam:RemoveClientIDFromOpenIDConnectProvider",
      "iam:TagOpenIDConnectProvider",
      "iam:UntagOpenIDConnectProvider",
      "iam:UpdateOpenIDConnectProviderThumbprint"
    ]

    resources = [
      "arn:aws:iam::232499238146:oidc-provider/token.actions.githubusercontent.com"
    ]
  }

  statement {
    sid    = "ManageProductionIAMRoles"
    effect = "Allow"

    actions = [
      "iam:AttachRolePolicy",
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:DeleteRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PassRole",
      "iam:PutRolePolicy",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:UpdateRole",
      "iam:UpdateRoleDescription"
    ]

    resources = [
      "arn:aws:iam::232499238146:role/heymoney-production-*"
    ]
  }

  statement {
    sid    = "CreateRequiredServiceLinkedRoles"
    effect = "Allow"

    actions = [
      "iam:CreateServiceLinkedRole"
    ]

    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "iam:AWSServiceName"

      values = [
        "ecs.amazonaws.com",
        "elasticloadbalancing.amazonaws.com"
      ]
    }
  }
}

resource "aws_iam_role_policy" "github_actions_terraform_apply_infrastructure" {
  name   = "heymoney-production-terraform-apply-infrastructure"
  role   = aws_iam_role.github_actions_terraform_apply.id
  policy = data.aws_iam_policy_document.github_actions_terraform_apply_infrastructure.json
}
